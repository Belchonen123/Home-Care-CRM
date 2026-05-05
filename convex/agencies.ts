import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { AccessError, getIdentity, requirePermission } from "./lib/access";
import { logAudit } from "./lib/audit";

const stateCode = v.union(v.literal("NY"), v.literal("MI"));
const program = v.union(
  v.literal("ny_mltc"),
  v.literal("ny_cdpap"),
  v.literal("ny_private_pay"),
  v.literal("mi_home_help"),
  v.literal("mi_mi_choice"),
  v.literal("mi_private_pay"),
);

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

const DEFAULT_SETTINGS = {
  geofenceRadiusMeters: 150,
  lateClockInToleranceMinutes: 15,
  missedVisitGraceMinutes: 30,
  idleSessionTimeoutMinutes: 15,
  timezone: "America/New_York",
  consumerLabel: "Client",
  caregiverLabel: "Caregiver",
};

const VALID_PROGRAMS_FOR_STATE: Record<"NY" | "MI", readonly string[]> = {
  NY: ["ny_mltc", "ny_cdpap", "ny_private_pay"],
  MI: ["mi_home_help", "mi_mi_choice", "mi_private_pay"],
};

/**
 * Returns the caller's active agency + their role in it. Powers the org
 * switcher and gates onboarding.
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const orgId = (identity as unknown as { org_id?: string }).org_id;
    if (!orgId) return null;

    const agency = await ctx.db
      .query("agencies")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", orgId))
      .unique();

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_clerk_org_user", (q) =>
        q.eq("clerkOrgId", orgId).eq("clerkUserId", identity.subject),
      )
      .filter((q) => q.eq(q.field("revokedAt"), undefined))
      .first();

    return {
      agency,
      membership: membership
        ? { role: membership.role, caregiverId: membership.caregiverId }
        : null,
    };
  },
});

/**
 * Idempotently creates the agencies row + owner membership for the Clerk
 * organization the caller is signed into. Safe to call from /onboarding's
 * load path; subsequent calls return the existing agencyId.
 */
export const bootstrap = mutation({
  args: { primaryEmail: v.string(), agencyName: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    const now = Date.now();

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .unique();
    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkUserId: identity.clerkUserId,
        email: identity.email ?? args.primaryEmail,
        fullName: identity.name ?? args.primaryEmail,
        createdAt: now,
      });
      user = await ctx.db.get(userId);
    }
    if (!user) {
      throw new ConvexError({ code: "INTERNAL", message: "user create failed" });
    }

    const existing = await ctx.db
      .query("agencies")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", identity.clerkOrgId))
      .unique();
    if (existing) {
      return existing._id;
    }

    const agencyId = await ctx.db.insert("agencies", {
      clerkOrgId: identity.clerkOrgId,
      name: args.agencyName,
      states: [],
      programs: [],
      addresses: [],
      billingContact: { name: identity.name ?? args.agencyName, email: args.primaryEmail },
      providerIds: {},
      settings: DEFAULT_SETTINGS,
      onboardingComplete: false,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("memberships", {
      agencyId,
      userId: user._id,
      clerkOrgId: identity.clerkOrgId,
      clerkUserId: identity.clerkUserId,
      role: "owner",
      acceptedAt: now,
      createdAt: now,
    });

    // Direct insert here is the only place outside `logAudit()` that writes to
    // auditLog — the membership doesn't yet exist when this row is created, so
    // logAudit's typed wrapper would fail.
    await ctx.db.insert("auditLog", {
      agencyId,
      actorUserId: user._id,
      actorClerkUserId: identity.clerkUserId,
      actorRole: "owner",
      action: "agency.create",
      targetTable: "agencies",
      targetId: agencyId,
      summary: "Agency bootstrapped during onboarding",
      at: now,
    });
    await ctx.db.insert("auditLog", {
      agencyId,
      actorUserId: user._id,
      actorClerkUserId: identity.clerkUserId,
      actorRole: "owner",
      action: "user.role_assigned",
      targetTable: "memberships",
      targetId: user._id,
      summary: "Assigned owner role to bootstrapping user",
      at: now,
    });

    return agencyId;
  },
});

/**
 * Persists the onboarding wizard's collected state and (when `markComplete`)
 * captures the BAA acknowledgment receipt. Server-side re-validates everything
 * the client form already validated with zod.
 */
export const completeOnboarding = mutation({
  args: {
    legalName: v.optional(v.string()),
    states: v.array(stateCode),
    programs: v.array(program),
    npi: v.optional(v.string()),
    taxId: v.optional(v.string()),
    addresses: v.array(usAddress),
    billingContact: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
    }),
    providerIds: v.object({
      champsProviderId: v.optional(v.string()),
      hhaxProviderIds: v.optional(
        v.array(v.object({ mltc: v.string(), id: v.string() })),
      ),
      sandataAccountId: v.optional(v.string()),
    }),
    timezone: v.optional(v.string()),
    baaAcknowledged: v.boolean(),
    requesterIp: v.optional(v.string()),
    markComplete: v.boolean(),
  },
  handler: async (ctx, args) => {
    let m;
    try {
      m = await requirePermission(ctx, "agency.write");
    } catch (e) {
      if (e instanceof AccessError && e.data.code === "NOT_A_MEMBER") {
        // First-run: bootstrap hasn't been called yet by the client.
        throw new ConvexError({
          code: "ONBOARDING_NOT_BOOTSTRAPPED",
          message: "Call agencies.bootstrap before completeOnboarding.",
        });
      }
      throw e;
    }

    if (args.states.length === 0) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Choose at least one state of operation.",
      });
    }
    if (args.programs.length === 0) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Choose at least one program.",
      });
    }
    for (const p of args.programs) {
      const matchedState = args.states.find((s) =>
        VALID_PROGRAMS_FOR_STATE[s].includes(p),
      );
      if (!matchedState) {
        throw new ConvexError({
          code: "VALIDATION",
          message: `Program ${p} requires a state of operation that authorizes it.`,
        });
      }
    }

    if (args.npi && !/^\d{10}$/.test(args.npi)) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "NPI must be exactly 10 digits.",
      });
    }
    if (args.npi && !npiLuhnValid(args.npi)) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "NPI checksum invalid.",
      });
    }

    if (args.markComplete && !args.baaAcknowledged) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "BAA must be acknowledged before completing onboarding.",
      });
    }

    const agency = await ctx.db.get(m.agencyId);
    if (!agency) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Agency not found." });
    }

    const now = Date.now();
    await ctx.db.patch(m.agencyId, {
      legalName: args.legalName,
      states: args.states,
      programs: args.programs,
      npi: args.npi,
      taxId: args.taxId,
      addresses: args.addresses,
      billingContact: args.billingContact,
      providerIds: args.providerIds,
      settings: {
        ...agency.settings,
        ...(args.timezone ? { timezone: args.timezone } : {}),
      },
      onboardingComplete: args.markComplete ? true : agency.onboardingComplete,
      ...(args.markComplete && args.baaAcknowledged
        ? {
            baaAcknowledgedAt: now,
            baaAcknowledgedByUserId: m.userId,
            baaAcknowledgedFromIp: args.requesterIp,
          }
        : {}),
      updatedAt: now,
    });

    await logAudit(ctx, m, {
      action: args.markComplete ? "agency.complete_onboarding" : "agency.update_onboarding",
      entityType: "agencies",
      entityId: m.agencyId,
      summary: args.markComplete
        ? "Marked onboarding complete; BAA acknowledged"
        : "Updated onboarding info",
    });
    if (args.markComplete && args.baaAcknowledged) {
      await logAudit(ctx, m, {
        action: "agency.baa_acknowledged",
        entityType: "agencies",
        entityId: m.agencyId,
        summary: "BAA acknowledgment captured during onboarding",
        ip: args.requesterIp,
      });
    }

    return m.agencyId;
  },
});

/**
 * NPI checksum (CMS specifies a Luhn variant: append "80840" prefix to the
 * 9-digit body, then standard Luhn over the resulting 14 digits where the
 * 10th digit is the check digit).
 */
function npiLuhnValid(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = `80840${npi.slice(0, 9)}`;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i] as string, 10);
    if ((digits.length - 1 - i) % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(npi[9] as string, 10);
}
