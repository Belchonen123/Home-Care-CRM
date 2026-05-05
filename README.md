# Home Care CRM

Multi-tenant home-care CRM with Electronic Visit Verification (EVV) for
non-medical and Medicaid agencies in **New York** (HHAeXchange-aggregated MLTCs)
and **Michigan** (CHAMPS / MDHHS Home Help). Built on Next.js 16, React 19,
Tailwind 4, Convex 1.37, and Clerk.

The product spec lives in [`HOMECARE_CRM_SPEC.md`](./HOMECARE_CRM_SPEC.md);
[`CLAUDE.md`](./CLAUDE.md) is the hard-rules summary every contributor reads
first.

## Develop

```bash
nvm use                # Node 20 LTS (see .nvmrc)
corepack enable        # pnpm 9 via packageManager
pnpm install
cp .env.example .env.local
$EDITOR .env.local     # fill in Convex + Clerk + PHI_ENCRYPTION_KEY
pnpm convex:dev        # terminal A — deploys schema, generates types
pnpm dev               # terminal B — http://localhost:3000
```

Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.

## Required environment

| Var | Why |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Browser-side Convex client target. |
| `CONVEX_DEPLOY_KEY` | `pnpm convex:dev` / `convex deploy`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Auth. |
| `CLERK_WEBHOOK_SECRET` | Verifying Clerk webhook signatures (Phase 2). |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex auth.config validates JWTs from this issuer. Create a Clerk JWT template named `convex` (`aud=convex`) with `org_id`, `org_role`, `org_slug` claims. |
| `PHI_ENCRYPTION_KEY` | 32-byte base64 AES-256 key (`openssl rand -base64 32`). Set on the Convex deployment via `npx convex env set PHI_ENCRYPTION_KEY ...`. |
| `MAPBOX_TOKEN` | Optional. Server-side address geocoding for client intake. |
| `POSTMARK_SERVER_TOKEN` / `POSTMARK_FROM` | Email channel for alerts (deferred to Phase 7). |

## Project structure (excerpt)

- `convex/` — schema, queries, mutations, actions, crons.
- `convex/lib/` — `access.ts` (auth + RBAC), `audit.ts` (append-only log
  helper), `crypto.ts` (PHI encryption), `dates.ts`, `softDelete.ts`,
  `expiryStatus.ts`, `authMath.ts`-style pure helpers.
- `src/app/` — Next.js App Router. `(app)/` is the authenticated shell;
  `/onboarding` is the agency setup wizard; `/sign-in` and `/sign-up`
  mount Clerk's hosted components.
- `src/lib/validation/` — zod schemas shared between forms and Convex
  mutations.
- `src/components/` — `ui/` shadcn primitives, `shell/` sidebar + nav +
  notifications, plus per-feature folders (`onboarding`, `clients`,
  `caregivers`).

## Phase status

See [`PHASE1-RETRO.md`](./PHASE1-RETRO.md) for the v0.1.0 retro.

| Phase | Status |
| --- | --- |
| 1 — Foundation | ✅ shipped (v0.1.0) |
| 2 — Scheduling, Plan of Care | ⏳ next |
| 3 — EVV Capture | ⏳ |
| 4 — EVV Submission & Exceptions | ⏳ |
| 5 — Billing | ⏳ |
| 6 — Compliance & Reporting | ⏳ |
| 7 — Polish, perf, HIPAA prep | ⏳ |

## License

Proprietary. Internal use only.
