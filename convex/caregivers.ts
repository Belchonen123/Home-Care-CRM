import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  hasPermission,
  requirePermission,
  type Membership,
} from "./lib/access";
import { logAudit, diffFieldNames } from "./lib/audit";
import { encryptField } from "./lib/crypto";
import { softDelete } from "./lib/softDelete";
import type { Doc, Id } from "./_generated/dataModel";

const usAddress = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
  country: v.literal("US"),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  geocodedAt: v.optional(v.number()),
});

const classification = v.union(
  v.literal("hha"),
  v.literal("pca"),
  v.literal("cna"),
  v.literal("dcw"),
  v.literal("companion"),
);

const employmentType = v.union(v.literal("employee"), v.literal("contractor"));

const status = v.union(
  v.literal("applicant"),
  v.literal("active"),
  v.literal("inactive"),
  v.literal("terminated"),
);

const availabilityWindow = v.object({
  dayOfWeek: v.number(),
  startMinute: v.number(),
  endMinute: v.number(),
});

/* --------------------------------- queries -------------------------------- */

export const list = query({
  args: {
    statusFilter: v.optional(status),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "caregiver.read");
    const cap = Math.min(args.limit ?? 100, 500);
    const cursor = args.statusFilter
      ? ctx.db
          .query("caregivers")
          .withIndex("by_agency_status", (q) =>
            q
              .eq("agencyId", m.agencyId)
              .eq("status", args.statusFilter as Doc<"caregivers">["status"]),
          )
      : ctx.db
          .query("caregivers")
          .withIndex("by_agency_lastname", (q) => q.eq("agencyId", m.agencyId));

    const rows = await cursor.filter((q) => q.eq(q.field("deletedAt"), undefined)).take(cap);
    const term = args.search?.trim().toLowerCase();
    const filtered = term
      ? rows.filter(
          (c) =>
            c.firstName.toLowerCase().includes(term) ||
            c.lastName.toLowerCase().includes(term),
        )
      : rows;

    return filtered.map((c) => ({
      _id: c._id,
      firstName: c.firstName,
      lastName: c.lastName,
      classifications: c.classifications,
      languages: c.languages,
      status: c.status,
      city: c.address?.city,
      stateCode: c.address?.state,
      hireDate: c.hireDate,
      employmentType: c.employmentType,
      phone: c.phone,
    }));
  },
});

export const get = query({
  args: { caregiverId: v.id("caregivers") },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "caregiver.read");
    const cg = await ctx.db.get(args.caregiverId);
    if (!cg || cg.agencyId !== m.agencyId || cg.deletedAt) return null;

    const canSeeSsn = hasPermission(m.role, "phi.ssn.read");
    return {
      ...cg,
      ssnEncrypted: undefined,
      ssnPresent: !!cg.ssnEncrypted,
      ivrPinHash: undefined,
      _canSeeSsn: canSeeSsn,
    };
  },
});

/* -------------------------------- mutations ------------------------------- */

const createInput = v.object({
  firstName: v.string(),
  lastName: v.string(),
  preferredName: v.optional(v.string()),
  dateOfBirth: v.optional(v.string()),
  ssn: v.optional(v.string()),
  languages: v.array(v.string()),
  address: v.optional(usAddress),
  phone: v.string(),
  email: v.optional(v.string()),
  classifications: v.array(classification),
  employmentType,
  hireDate: v.optional(v.string()),
  payRate: v.optional(v.number()),
  overtimeMultiplier: v.optional(v.number()),
  availability: v.optional(v.array(availabilityWindow)),
  maxWeeklyHours: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const create = mutation({
  args: createInput,
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "caregiver.write");
    return createImpl(ctx, m, args);
  },
});

async function createImpl(
  ctx: MutationCtx,
  m: Membership,
  args: typeof createInput.type,
): Promise<Id<"caregivers">> {
  if (args.classifications.length === 0) {
    throw new ConvexError({
      code: "VALIDATION",
      message: "At least one classification is required.",
    });
  }
  if (args.payRate !== undefined && args.payRate < 0) {
    throw new ConvexError({ code: "VALIDATION", message: "Pay rate must be ≥ 0." });
  }
  for (const w of args.availability ?? []) {
    if (
      w.startMinute < 0 ||
      w.endMinute > 24 * 60 ||
      w.startMinute >= w.endMinute ||
      w.dayOfWeek < 0 ||
      w.dayOfWeek > 6
    ) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Invalid availability window.",
      });
    }
  }

  const ssnEncrypted = args.ssn ? await encryptField(args.ssn) : undefined;
  const dobEncrypted = args.dateOfBirth ? await encryptField(args.dateOfBirth) : undefined;

  const now = Date.now();
  const { ssn: _ssn, dateOfBirth: _dob, ...rest } = args;
  void _ssn;
  void _dob;

  const id = await ctx.db.insert("caregivers", {
    agencyId: m.agencyId,
    ...rest,
    availability: args.availability ?? [],
    ssnEncrypted,
    dobEncrypted,
    status: "applicant",
    createdAt: now,
    updatedAt: now,
  });
  await logAudit(ctx, m, {
    action: "caregiver.create",
    entityType: "caregivers",
    entityId: id,
    summary: "Added caregiver (applicant)",
  });
  return id;
}

export const update = mutation({
  args: {
    caregiverId: v.id("caregivers"),
    patch: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      preferredName: v.optional(v.string()),
      languages: v.optional(v.array(v.string())),
      address: v.optional(usAddress),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      classifications: v.optional(v.array(classification)),
      employmentType: v.optional(employmentType),
      payRate: v.optional(v.number()),
      overtimeMultiplier: v.optional(v.number()),
      availability: v.optional(v.array(availabilityWindow)),
      maxWeeklyHours: v.optional(v.number()),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "caregiver.write");
    const before = await ctx.db.get(args.caregiverId);
    if (!before || before.agencyId !== m.agencyId || before.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Caregiver not found." });
    }
    const patch = { ...args.patch, updatedAt: Date.now() };
    await ctx.db.patch(args.caregiverId, patch);
    await logAudit(ctx, m, {
      action: "caregiver.update",
      entityType: "caregivers",
      entityId: args.caregiverId,
      summary: "Updated caregiver record",
      fieldChanges: diffFieldNames(before, patch),
    });
  },
});

export const setStatus = mutation({
  args: {
    caregiverId: v.id("caregivers"),
    status,
    terminationDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "caregiver.write");
    const cg = await ctx.db.get(args.caregiverId);
    if (!cg || cg.agencyId !== m.agencyId || cg.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Caregiver not found." });
    }
    if (args.status === "terminated" && !args.terminationDate) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Termination date is required when status is terminated.",
      });
    }

    await ctx.db.patch(args.caregiverId, {
      status: args.status,
      terminationDate: args.terminationDate ?? cg.terminationDate,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, m, {
      action: "caregiver.set_status",
      entityType: "caregivers",
      entityId: args.caregiverId,
      summary: `Status -> ${args.status}`,
      fieldChanges: ["status", "terminationDate"],
    });
  },
});

export const remove = mutation({
  args: { caregiverId: v.id("caregivers"), reason: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "caregiver.delete");
    await softDelete(ctx, "caregivers", args.caregiverId, { reason: args.reason });
  },
});
