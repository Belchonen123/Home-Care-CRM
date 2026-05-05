import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type AppRole = Doc<"memberships">["role"];

/**
 * Permission matrix from spec §7. Adding a new route surface either lands in this
 * table or gets a new permission added — never check role names directly in
 * route code.
 */
export const PERMISSIONS = {
  "agency.read": ["owner", "admin", "scheduler", "intake", "biller", "compliance", "viewer"],
  "agency.write": ["owner", "admin"],
  "agency.settings.write": ["owner"],

  "client.read": ["owner", "admin", "scheduler", "intake", "biller", "compliance", "viewer"],
  "client.read.assigned": ["caregiver"],
  "client.write": ["owner", "admin", "intake", "scheduler"],
  "client.delete": ["owner"],

  "caregiver.read": ["owner", "admin", "scheduler", "biller", "compliance", "viewer"],
  "caregiver.read.self": ["caregiver"],
  "caregiver.write": ["owner", "admin"],
  "caregiver.delete": ["owner"],

  "credential.read": ["owner", "admin", "scheduler", "compliance", "viewer"],
  "credential.write": ["owner", "admin", "compliance"],

  "authorization.read": [
    "owner",
    "admin",
    "scheduler",
    "intake",
    "biller",
    "compliance",
    "viewer",
  ],
  "authorization.write": ["owner", "admin", "intake"],

  "schedule.read": ["owner", "admin", "scheduler", "intake", "biller", "compliance", "viewer"],
  "schedule.write": ["owner", "admin", "scheduler"],

  "visit.read": ["owner", "admin", "scheduler", "biller", "compliance", "viewer"],
  "visit.read.own": ["caregiver"],
  "visit.write": ["owner", "admin", "scheduler"],
  "visit.clock": ["caregiver", "owner", "admin", "scheduler"],

  "evv.exception.write": ["owner", "admin", "compliance", "scheduler"],
  "evv.submission.read": ["owner", "admin", "compliance"],

  "billing.read": ["owner", "admin", "biller", "compliance"],
  "billing.write": ["owner", "admin", "biller"],

  "audit.read": ["owner", "compliance", "admin"],

  "phi.ssn.read": ["owner", "admin", "biller", "compliance"],
  "phi.dob.read": ["owner", "admin", "scheduler", "intake", "biller", "compliance"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export type AccessErrorCode =
  | "NOT_AUTHENTICATED"
  | "NO_ACTIVE_AGENCY"
  | "NOT_A_MEMBER"
  | "DEACTIVATED"
  | "FORBIDDEN"
  | "WRONG_TENANT";

export class AccessError extends ConvexError<{
  code: AccessErrorCode;
  message: string;
}> {
  constructor(code: AccessErrorCode, message: string) {
    super({ code, message });
  }
}

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

export interface CallerIdentity {
  clerkUserId: string;
  clerkOrgId: string;
  clerkOrgRole?: string;
  email?: string;
  name?: string;
}

export async function getIdentity(ctx: AnyCtx): Promise<CallerIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AccessError("NOT_AUTHENTICATED", "Sign in required.");
  }
  const orgId = (identity as unknown as { org_id?: string }).org_id;
  if (!orgId) {
    throw new AccessError("NO_ACTIVE_AGENCY", "Select an agency to continue.");
  }
  return {
    clerkUserId: identity.subject,
    clerkOrgId: orgId,
    clerkOrgRole: (identity as unknown as { org_role?: string }).org_role,
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
  };
}

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const id = await getIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", id.clerkUserId))
    .unique();
  if (!user) {
    throw new AccessError("NOT_A_MEMBER", "User record not found.");
  }
  if (user.deactivatedAt) {
    throw new AccessError("DEACTIVATED", "User is deactivated.");
  }
  return user;
}

export interface Membership {
  membershipId: Id<"memberships">;
  agencyId: Id<"agencies">;
  userId: Id<"users">;
  role: AppRole;
  caregiverId?: Id<"caregivers">;
  identity: CallerIdentity;
}

/**
 * Resolves the caller's membership for the active agency. If `agencyId` is given,
 * additionally asserts it matches.
 */
export async function getCurrentAgencyMembership(
  ctx: QueryCtx | MutationCtx,
  agencyId?: Id<"agencies">,
): Promise<Membership> {
  const identity = await getIdentity(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_clerk_org_user", (q) =>
      q.eq("clerkOrgId", identity.clerkOrgId).eq("clerkUserId", identity.clerkUserId),
    )
    .filter((q) => q.eq(q.field("revokedAt"), undefined))
    .first();

  if (!membership) {
    throw new AccessError("NOT_A_MEMBER", "You are not a member of this agency.");
  }
  if (agencyId && membership.agencyId !== agencyId) {
    throw new AccessError("WRONG_TENANT", "Cross-agency access denied.");
  }
  return {
    membershipId: membership._id,
    agencyId: membership.agencyId,
    userId: membership.userId,
    role: membership.role,
    caregiverId: membership.caregiverId,
    identity,
  };
}

/** Alias kept for shorter call sites. */
export const requireMembership = getCurrentAgencyMembership;

export function hasPermission(role: AppRole, perm: Permission): boolean {
  return (PERMISSIONS[perm] as readonly AppRole[]).includes(role);
}

/** Throws AccessError("FORBIDDEN") unless the caller's role grants `perm`. */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  perm: Permission,
  agencyId?: Id<"agencies">,
): Promise<Membership> {
  const m = await getCurrentAgencyMembership(ctx, agencyId);
  if (!hasPermission(m.role, perm)) {
    throw new AccessError("FORBIDDEN", `Missing permission: ${perm}`);
  }
  return m;
}

/** Throws AccessError("FORBIDDEN") unless the caller's role is in the allow-list. */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  roles: readonly AppRole[],
  agencyId?: Id<"agencies">,
): Promise<Membership> {
  const m = await getCurrentAgencyMembership(ctx, agencyId);
  if (!roles.includes(m.role)) {
    throw new AccessError("FORBIDDEN", `Role ${m.role} not in [${roles.join(", ")}]`);
  }
  return m;
}
