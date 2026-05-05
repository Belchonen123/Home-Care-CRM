import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/access";
import { logAudit } from "./lib/audit";
import { daysBetween, isoDate } from "./lib/dates";

const credKind = v.union(
  v.literal("hha_certification"),
  v.literal("pca_certification"),
  v.literal("cna_certification"),
  v.literal("dcw_training"),
  v.literal("cpr"),
  v.literal("first_aid"),
  v.literal("tb_test"),
  v.literal("physical"),
  v.literal("background_check"),
  v.literal("driver_license"),
  v.literal("auto_insurance"),
  v.literal("i9"),
  v.literal("w4"),
  v.literal("other"),
);

export type CredentialKind = typeof credKind.type;

export const listForCaregiver = query({
  args: { caregiverId: v.id("caregivers") },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "credential.read");
    const cg = await ctx.db.get(args.caregiverId);
    if (!cg || cg.agencyId !== m.agencyId) return [];

    const rows = await ctx.db
      .query("credentials")
      .withIndex("by_caregiver", (q) => q.eq("caregiverId", args.caregiverId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const today = isoDate(Date.now());
    return rows
      .map((c) => {
        const daysUntil = c.expiresAt ? daysBetween(today, c.expiresAt) : null;
        const expiryStatus =
          daysUntil === null
            ? "no_expiry"
            : daysUntil < 0
              ? "expired"
              : daysUntil <= 7
                ? "critical"
                : daysUntil <= 30
                  ? "warning"
                  : "ok";
        return { ...c, daysUntilExpiry: daysUntil, expiryStatus };
      })
      .sort((a, b) => {
        // Expired first, then closest expiry, then no-expiry tail.
        const aDays = a.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        const bDays = b.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        return aDays - bDays;
      });
  },
});

export const expiringSoon = query({
  args: { withinDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "credential.read");
    const today = isoDate(Date.now());
    const window = args.withinDays ?? 30;
    const rows = await ctx.db
      .query("credentials")
      .withIndex("by_agency_expires", (q) => q.eq("agencyId", m.agencyId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return rows
      .filter((c) => c.expiresAt)
      .map((c) => ({ c, days: daysBetween(today, c.expiresAt as string) }))
      .filter((x) => x.days <= window)
      .sort((a, b) => a.days - b.days)
      .map((x) => ({
        _id: x.c._id,
        caregiverId: x.c.caregiverId,
        kind: x.c.kind,
        label: x.c.label,
        expiresAt: x.c.expiresAt,
        daysUntilExpiry: x.days,
      }));
  },
});

export const create = mutation({
  args: {
    caregiverId: v.id("caregivers"),
    kind: credKind,
    label: v.optional(v.string()),
    issuer: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    issuedDate: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "credential.write");
    const cg = await ctx.db.get(args.caregiverId);
    if (!cg || cg.agencyId !== m.agencyId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Caregiver not found." });
    }
    if (args.expiresAt && args.issuedDate && args.expiresAt < args.issuedDate) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Expiry must be on or after the issued date.",
      });
    }
    const now = Date.now();
    const id = await ctx.db.insert("credentials", {
      agencyId: m.agencyId,
      caregiverId: args.caregiverId,
      kind: args.kind,
      label: args.label,
      issuer: args.issuer,
      documentNumber: args.documentNumber,
      issuedDate: args.issuedDate,
      expiresAt: args.expiresAt,
      fileStorageId: args.fileStorageId,
      alertsSent: [],
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, m, {
      action: "credential.create",
      entityType: "credentials",
      entityId: id,
      summary: `Added ${args.kind} credential`,
    });
    return id;
  },
});

export const remove = mutation({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "credential.write");
    const cred = await ctx.db.get(args.credentialId);
    if (!cred || cred.agencyId !== m.agencyId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Credential not found." });
    }
    await ctx.db.delete(args.credentialId);
    await logAudit(ctx, m, {
      action: "credential.delete",
      entityType: "credentials",
      entityId: args.credentialId,
      summary: `Removed ${cred.kind}`,
    });
  },
});
