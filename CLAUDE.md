# CLAUDE.md

> **Source of truth.** All product, domain, schema, and policy decisions live in
> [`HOMECARE_CRM_SPEC.md`](./HOMECARE_CRM_SPEC.md). Re-read it at the start of every
> phase. If something here disagrees with the spec, the spec wins.

## Project at a glance

Multi-tenant home-care CRM with Electronic Visit Verification for non-medical and
Medicaid agencies in **NY (HHAeXchange/Sandata)** and **MI (CHAMPS / MDHHS Home
Help)**. Replaces the agency-side workflow currently fractured across HHAX,
Sandata, scheduling spreadsheets, paper timesheets, and billing add-ons.

## Hard rules (spec §2 — non-negotiable)

1. **Strict TypeScript.** No `any`. Convex schemas are the source of truth for types.
2. **No PHI in logs, URLs, or browser-console error messages.** Use IDs, not names.
3. **Audit + access on every PHI mutation.** Mutations that touch PHI must write to
   the audit log. Reads of PHI are rate-limited and access-checked. No client-side
   trust.
4. **No third-party scripts on PHI pages.** No Google Fonts CDN, no analytics, no
   chat widgets on routes that render PHI.

## Working agreements

- Branch per phase. PR per feature. Squash merge.
- Conventional commits (`feat(scheduler):`, `fix(evv):`).
- Every PR includes tests, a UI screenshot if the surface changed, and a
  `CHANGELOG.md` line.
- Pin versions exactly in `package.json` (no carets). Re-check
  Next/Convex/Clerk/Twilio docs at the start of each phase.
- Never ship a "demo mode" that disables auth. Sandbox tenant + synthetic data.

## How to run

```bash
nvm use                # Node 20 LTS
corepack enable        # pnpm 9 via packageManager
pnpm install
pnpm dev               # Next dev on :3000
pnpm convex:dev        # Convex dev (separate terminal)
pnpm test              # vitest
pnpm test:e2e          # Playwright
pnpm lint && pnpm typecheck
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full developer guide.

## Phase status

- [x] Phase 1 — Foundation (in progress)
- [ ] Phase 2 — Scheduling
- [ ] Phase 3 — EVV Capture
- [ ] Phase 4 — EVV Submission & Exceptions
- [ ] Phase 5 — Billing
- [ ] Phase 6 — Compliance & Reporting
- [ ] Phase 7 — Polish

Refer to spec §6 for the full plan and acceptance criteria for each phase.
