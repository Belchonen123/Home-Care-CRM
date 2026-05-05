/**
 * Convex auth — Clerk JWT verification.
 *
 * Setup:
 *   1. In Clerk dashboard → JWT templates, create one named "convex" with `aud=convex`
 *      and include the org_id, org_role, and org_slug claims so requireMembership()
 *      doesn't need an extra round trip.
 *   2. Set CLERK_JWT_ISSUER_DOMAIN in Convex env (npx convex env set ...).
 */
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN ?? "",
      applicationID: "convex",
    },
  ],
};

export default authConfig;
