import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/access";
import { logAudit } from "./lib/audit";

const payerKind = v.union(
  v.literal("mltc"),
  v.literal("mco"),
  v.literal("medicaid_ffs"),
  v.literal("private_pay"),
  v.literal("vet_admin"),
  v.literal("ltc_insurance"),
);

const aggregator = v.union(
  v.literal("hhaexchange"),
  v.literal("sandata"),
  v.literal("champs"),
  v.literal("none"),
);

export const list = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "agency.read");
    const cursor = args.activeOnly
      ? ctx.db
          .query("payers")
          .withIndex("by_agency_active", (q) =>
            q.eq("agencyId", m.agencyId).eq("isActive", true),
          )
      : ctx.db
          .query("payers")
          .withIndex("by_agency", (q) => q.eq("agencyId", m.agencyId));
    return cursor.collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    kind: payerKind,
    aggregator,
    aggregatorAccountId: v.optional(v.string()),
    payerIdExternal: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "agency.write");
    const now = Date.now();
    const id = await ctx.db.insert("payers", {
      agencyId: m.agencyId,
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, m, {
      action: "payer.create",
      entityType: "payers",
      entityId: id,
      summary: `Added payer ${args.name} (${args.kind})`,
    });
    return id;
  },
});

export const setActive = mutation({
  args: { payerId: v.id("payers"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "agency.write");
    const payer = await ctx.db.get(args.payerId);
    if (!payer || payer.agencyId !== m.agencyId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payer not found." });
    }
    await ctx.db.patch(args.payerId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, m, {
      action: "payer.set_active",
      entityType: "payers",
      entityId: args.payerId,
      summary: `Active -> ${args.isActive}`,
    });
  },
});
