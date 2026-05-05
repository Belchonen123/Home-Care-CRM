import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/access";

/**
 * Compliance-only audit-log feed. Every PHI mutation lands here via
 * `convex/lib/audit.ts:logAudit`. Reads of decrypted PHI fields land here as
 * `phi.read.<field>`.
 */
export const list = query({
  args: {
    sinceDays: v.optional(v.number()),
    limit: v.optional(v.number()),
    actionPrefix: v.optional(v.string()),
    targetTable: v.optional(v.string()),
    targetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "audit.read");

    const cap = Math.min(args.limit ?? 200, 1000);

    if (args.targetTable && args.targetId) {
      const rows = await ctx.db
        .query("auditLog")
        .withIndex("by_agency_target", (q) =>
          q
            .eq("agencyId", m.agencyId)
            .eq("targetTable", args.targetTable)
            .eq("targetId", args.targetId),
        )
        .order("desc")
        .take(cap);
      return rows;
    }

    const since = Date.now() - (args.sinceDays ?? 30) * 86_400_000;
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_agency_at", (q) => q.eq("agencyId", m.agencyId).gte("at", since))
      .order("desc")
      .take(cap);

    if (args.actionPrefix) {
      return rows.filter((r) => r.action.startsWith(args.actionPrefix as string));
    }
    return rows;
  },
});

/** Per-record timeline tab (clients, caregivers, authorizations, visits). */
export const timelineFor = query({
  args: {
    targetTable: v.string(),
    targetId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "audit.read");
    return ctx.db
      .query("auditLog")
      .withIndex("by_agency_target", (q) =>
        q
          .eq("agencyId", m.agencyId)
          .eq("targetTable", args.targetTable)
          .eq("targetId", args.targetId),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 100, 500));
  },
});
