import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/access";
import { logAudit, diffFieldNames } from "./lib/audit";
import { softDelete } from "./lib/softDelete";
import { daysBetween, isoDate } from "./lib/dates";

const authStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("expired"),
  v.literal("voided"),
);

const miTaskCategory = v.object({
  category: v.string(),
  minutes: v.number(),
});

/**
 * Pure helper: hours-remaining math from the schema fields. Caller must already
 * have validated tenant access.
 */
function computeUtilization(authorizedUnits: number, consumedUnits: number, unitMinutes: number) {
  const remaining = Math.max(0, authorizedUnits - consumedUnits);
  return {
    remainingUnits: remaining,
    remainingHours: (remaining * unitMinutes) / 60,
    utilizationPct: authorizedUnits
      ? Math.min(100, Math.round((consumedUnits / authorizedUnits) * 100))
      : 0,
    consumedHours: (consumedUnits * unitMinutes) / 60,
    authorizedHours: (authorizedUnits * unitMinutes) / 60,
  };
}

/**
 * Pure validator: when the auth is for MI Home Help, the per-task-category
 * minutes (multiplied across the authorization period) must total the
 * authorized minutes. v1 v0 behavior — exact equality. Callers gate this on
 * service-code prefix.
 */
export function miTaskCategoryMinutesValid(
  rows: { category: string; minutes: number }[],
  expectedMonthlyMinutes: number,
): boolean {
  const sum = rows.reduce((acc, r) => acc + r.minutes, 0);
  return sum === expectedMonthlyMinutes;
}

export const listForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "authorization.read");
    const client = await ctx.db.get(args.clientId);
    if (!client || client.agencyId !== m.agencyId) return [];

    const rows = await ctx.db
      .query("authorizations")
      .withIndex("by_agency_client", (q) =>
        q.eq("agencyId", m.agencyId).eq("clientId", args.clientId),
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const today = isoDate(Date.now());
    const payerIds = Array.from(new Set(rows.map((r) => r.payerId)));
    const fetched = await Promise.all(payerIds.map((id) => ctx.db.get(id)));
    const payerById = new Map(
      fetched.flatMap((p) => (p ? [[p._id, p] as const] : [])),
    );

    return rows
      .map((a) => ({
        ...a,
        ...computeUtilization(a.authorizedUnits, a.consumedUnits, a.unitMinutes),
        daysToExpiry: daysBetween(today, a.endDate),
        payerName: payerById.get(a.payerId)?.name ?? "Unknown payer",
        payerKind: payerById.get(a.payerId)?.kind ?? "unknown",
      }))
      .sort((a, b) => (a.endDate < b.endDate ? -1 : 1));
  },
});

export const get = query({
  args: { authorizationId: v.id("authorizations") },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "authorization.read");
    const auth = await ctx.db.get(args.authorizationId);
    if (!auth || auth.agencyId !== m.agencyId || auth.deletedAt) return null;
    return {
      ...auth,
      ...computeUtilization(auth.authorizedUnits, auth.consumedUnits, auth.unitMinutes),
    };
  },
});

const createInput = {
  clientId: v.id("clients"),
  payerId: v.id("payers"),
  externalAuthNumber: v.string(),
  serviceCode: v.string(),
  serviceDescription: v.optional(v.string()),
  startDate: v.string(),
  endDate: v.string(),
  unitMinutes: v.number(),
  authorizedUnits: v.number(),
  weeklyMaxUnits: v.optional(v.number()),
  monthlyMaxUnits: v.optional(v.number()),
  diagnoses: v.array(v.string()),
  miTaskCategoryMinutes: v.optional(v.array(miTaskCategory)),
  notes: v.optional(v.string()),
};

export const create = mutation({
  args: createInput,
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "authorization.write");

    const client = await ctx.db.get(args.clientId);
    if (!client || client.agencyId !== m.agencyId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    const payer = await ctx.db.get(args.payerId);
    if (!payer || payer.agencyId !== m.agencyId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payer not found." });
    }

    if (args.startDate >= args.endDate) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Auth start must be before end.",
      });
    }
    if (args.unitMinutes <= 0 || args.authorizedUnits <= 0) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Units must be positive.",
      });
    }

    // MI Home Help: per-task-category minutes must equal the authorized monthly
    // minutes (authorizedUnits * unitMinutes when monthlyMaxUnits is unset, or
    // monthlyMaxUnits * unitMinutes when set).
    if (
      client.program === "mi_home_help" &&
      args.miTaskCategoryMinutes &&
      args.miTaskCategoryMinutes.length > 0
    ) {
      const expectedMonthlyMinutes =
        (args.monthlyMaxUnits ?? args.authorizedUnits) * args.unitMinutes;
      if (!miTaskCategoryMinutesValid(args.miTaskCategoryMinutes, expectedMonthlyMinutes)) {
        throw new ConvexError({
          code: "VALIDATION",
          message: `MI Home Help: task-category minutes must total ${expectedMonthlyMinutes} (got ${args.miTaskCategoryMinutes.reduce((a, r) => a + r.minutes, 0)}).`,
        });
      }
    }

    // Dedupe on (agency, externalAuthNumber, clientId)
    const dupes = await ctx.db
      .query("authorizations")
      .withIndex("by_external", (q) =>
        q.eq("agencyId", m.agencyId).eq("externalAuthNumber", args.externalAuthNumber),
      )
      .collect();
    if (dupes.some((d) => d.clientId === args.clientId && !d.deletedAt)) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "An authorization with that number already exists for this client.",
      });
    }

    const now = Date.now();
    const id = await ctx.db.insert("authorizations", {
      agencyId: m.agencyId,
      ...args,
      consumedUnits: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, m, {
      action: "authorization.create",
      entityType: "authorizations",
      entityId: id,
      summary: `Auth ${args.externalAuthNumber} (${args.serviceCode}) for ${args.startDate}–${args.endDate}`,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    authorizationId: v.id("authorizations"),
    patch: v.object({
      endDate: v.optional(v.string()),
      authorizedUnits: v.optional(v.number()),
      weeklyMaxUnits: v.optional(v.number()),
      monthlyMaxUnits: v.optional(v.number()),
      status: v.optional(authStatus),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "authorization.write");
    const before = await ctx.db.get(args.authorizationId);
    if (!before || before.agencyId !== m.agencyId || before.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Authorization not found." });
    }
    if (
      args.patch.authorizedUnits !== undefined &&
      args.patch.authorizedUnits < before.consumedUnits
    ) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Cannot reduce authorized units below already-consumed units.",
      });
    }
    const patch = { ...args.patch, updatedAt: Date.now() };
    await ctx.db.patch(args.authorizationId, patch);
    await logAudit(ctx, m, {
      action: "authorization.update",
      entityType: "authorizations",
      entityId: args.authorizationId,
      summary: "Updated authorization",
      fieldChanges: diffFieldNames(before, patch),
    });
  },
});

export const remove = mutation({
  args: { authorizationId: v.id("authorizations"), reason: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "authorization.write");
    await softDelete(ctx, "authorizations", args.authorizationId, { reason: args.reason });
  },
});

/**
 * Recomputes consumedUnits from the visit log for one authorization. v1 stub:
 * visits are added in Phase 2; until then this resets to 0 and audits the
 * action so a later phase can confirm it ran.
 */
export const recomputeUsage = mutation({
  args: { authorizationId: v.id("authorizations") },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "authorization.write");
    const auth = await ctx.db.get(args.authorizationId);
    if (!auth || auth.agencyId !== m.agencyId || auth.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Authorization not found." });
    }

    const visits = await ctx.db
      .query("visits")
      .withIndex("by_agency_client_scheduled", (q) =>
        q.eq("agencyId", m.agencyId).eq("clientId", auth.clientId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("authorizationId"), auth._id),
          q.eq(q.field("status"), "completed"),
        ),
      )
      .collect();

    // Convert each completed visit's actual duration to authorization units.
    let totalUnits = 0;
    for (const v of visits) {
      if (!v.actualStart || !v.actualEnd) continue;
      const minutes = Math.max(0, (v.actualEnd - v.actualStart) / 60_000);
      totalUnits += Math.round(minutes / auth.unitMinutes);
    }

    const before = auth.consumedUnits;
    await ctx.db.patch(args.authorizationId, {
      consumedUnits: totalUnits,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, m, {
      action: "authorization.recompute_usage",
      entityType: "authorizations",
      entityId: args.authorizationId,
      summary: `Recomputed consumedUnits ${before} -> ${totalUnits} from ${visits.length} completed visits`,
      fieldChanges: ["consumedUnits"],
    });
    return { before, after: totalUnits };
  },
});

/**
 * Internal cron entry: marks authorizations whose endDate < today as `expired`
 * and emits a one-off audit row. Idempotent.
 */
export const markExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = isoDate(Date.now());
    const candidates = await ctx.db
      .query("authorizations")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    let updated = 0;
    for (const a of candidates) {
      if (a.endDate < today && !a.deletedAt) {
        await ctx.db.patch(a._id, { status: "expired", updatedAt: Date.now() });
        updated++;
      }
    }
    return { updated };
  },
});
