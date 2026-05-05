import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireMembership, requirePermission } from "./lib/access";
import { daysBetween, isoDate } from "./lib/dates";

type Threshold = "30" | "14" | "7";

function thresholdFor(days: number): Threshold | "expired" | null {
  if (days < 0) return "expired";
  if (days <= 7) return "7";
  if (days <= 14) return "14";
  if (days <= 30) return "30";
  return null;
}

export const listOpen = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const m = await requireMembership(ctx);
    return ctx.db
      .query("alerts")
      .withIndex("by_agency_unack", (q) =>
        q.eq("agencyId", m.agencyId).eq("acknowledgedAt", undefined),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const m = await requireMembership(ctx);
    const rows = await ctx.db
      .query("alerts")
      .withIndex("by_agency_unack", (q) =>
        q.eq("agencyId", m.agencyId).eq("acknowledgedAt", undefined),
      )
      .take(100);
    return rows.length;
  },
});

export const acknowledge = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    const m = await requireMembership(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert || alert.agencyId !== m.agencyId) return;
    await ctx.db.patch(args.alertId, {
      acknowledgedAt: Date.now(),
      acknowledgedBy: m.userId,
    });
  },
});

export const acknowledgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const m = await requirePermission(ctx, "agency.read");
    const rows = await ctx.db
      .query("alerts")
      .withIndex("by_agency_unack", (q) =>
        q.eq("agencyId", m.agencyId).eq("acknowledgedAt", undefined),
      )
      .take(500);
    for (const row of rows) {
      await ctx.db.patch(row._id, {
        acknowledgedAt: Date.now(),
        acknowledgedBy: m.userId,
      });
    }
    return rows.length;
  },
});

/**
 * Daily cron entrypoint. Idempotent: each (credential, threshold) pair only
 * raises an alert once per threshold (stored on the credential's `alertsSent`
 * array), and `credential_expired` alerts are deduped per credential.
 */
export const scanCredentialExpiries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = isoDate(Date.now());
    const credentials = await ctx.db
      .query("credentials")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    let raised = 0;

    for (const c of credentials) {
      if (!c.expiresAt) continue;
      const days = daysBetween(today, c.expiresAt);
      const threshold = thresholdFor(days);

      if (threshold === "expired") {
        const exists = await ctx.db
          .query("alerts")
          .withIndex("by_agency_kind", (q) =>
            q.eq("agencyId", c.agencyId).eq("kind", "credential_expired"),
          )
          .filter((q) => q.eq(q.field("targetCredentialId"), c._id))
          .first();
        if (!exists) {
          await ctx.db.insert("alerts", {
            agencyId: c.agencyId,
            kind: "credential_expired",
            severity: "critical",
            title: `${labelForKind(c.kind)} expired`,
            body: `${labelForKind(c.kind)} expired on ${c.expiresAt}.`,
            targetCaregiverId: c.caregiverId,
            targetCredentialId: c._id,
            createdAt: Date.now(),
          });
          raised++;
        }
        continue;
      }

      if (!threshold) continue;
      if (c.alertsSent.includes(threshold)) continue;

      await ctx.db.insert("alerts", {
        agencyId: c.agencyId,
        kind: "credential_expiring",
        severity: threshold === "7" ? "critical" : threshold === "14" ? "warning" : "info",
        title: `${labelForKind(c.kind)} expires in ${days} day${days === 1 ? "" : "s"}`,
        body: `${labelForKind(c.kind)} expires on ${c.expiresAt}.`,
        targetCaregiverId: c.caregiverId,
        targetCredentialId: c._id,
        createdAt: Date.now(),
      });
      await ctx.db.patch(c._id, {
        alertsSent: [...c.alertsSent, threshold],
        updatedAt: Date.now(),
      });
      raised++;
    }
    return { raised };
  },
});

function labelForKind(kind: string): string {
  return kind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
