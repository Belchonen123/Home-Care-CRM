# Phase 1 retro

One-page postmortem on what shipped, what didn't, and what we owe Phase 2.

## What shipped

| Area | Done |
| --- | --- |
| Repo, tooling | Next 16 (App Router, React 19), Tailwind 4 (CSS config), Convex 1.37, ESLint 9 flat config, Prettier, Vitest, Playwright, Husky + lint-staged, GitHub Actions (lint + typecheck + unit on PR; Playwright on main). Pinned versions, Node 20 LTS, pnpm 9. |
| Schema | All 16 domain tables from spec §4 with documented index map. Soft-delete on every PHI-bearing table. PHI fields encrypted at rest (AES-256-GCM via WebCrypto). |
| Auth | Clerk + Convex Auth. Clerk Organizations = agencies. Permission matrix from spec §7 driving every Convex query/mutation. |
| Audit | Append-only `auditLog` with `logAudit()` helper. Every PHI mutation emits a row. `phi.read.ssn` audit on privileged decrypt. Compliance-only `/app/compliance/audit` UI with filters + JSON detail drawer. |
| Onboarding | Six-step wizard (basics → states/programs → provider IDs → contacts → BAA → review). URL-persisted state, zod schemas client+server, CMS-correct NPI Luhn, BAA acknowledgment receipt with timestamp + IP. |
| Clients | List, intake form, detail with tabs (Overview, Authorizations, Plan of Care, Visits, Documents, Timeline). SSN + DOB encrypted, last-four masking helper, server-side Mapbox geocoding (cached), dobMonthDay surfaced for caregiver minimum-necessary views. |
| Caregivers | List, intake form, detail with tabs. Credentials sub-feature with color-coded expiry badges (success > 30d / warning 8–30d / destructive ≤ 7d / expired). Read-only weekly availability grid. |
| Credential alerts | Daily 12:00 UTC cron raises alerts at the 30/14/7-day thresholds and on expiry, deduped via `credentials.alertsSent`. Bell-icon top-bar dropdown with unread count + per-row dismiss + mark-all-as-read. |
| Authorizations | Per-client list with utilization progress bar, inline new-auth form with service-code catalog filtered by program, MDHHS-6064-P task-category table for MI Home Help with live total validation. `recomputeUsage` walks completed visits to derive consumed units. Cron: 30/14/7-day expiry alerts + 90% exhaustion alerts + auto-flip to status="expired". |
| Tests | 23 unit tests across crypto, access matrix, dates math, MI task-category validation, expiry classification. Playwright smoke (home page) + skipped Phase-1 happy-path skeleton gated on `E2E=1`. |

## Spec §11 acceptance check

| Item | Status |
| --- | --- |
| 1. Sign up, complete onboarding, add NPI/CHAMPS/HHAX IDs | ✅ |
| 2. Add 10 clients with addresses, authorizations, POC | Clients ✅, authorizations ✅, POC ⏳ Phase 2 |
| 3. Add 10 caregivers with credentials and availability | Caregivers ✅, credentials ✅, availability read-only |
| 4. Build a recurring weekly schedule | ⏳ Phase 2 |
| 5–10 | ⏳ Phases 3–6 |

## What's deferred to Phase 2 / paid down later

- **Document uploads** (Documents tabs on clients + caregivers + authorizations) — requires Convex file-storage upload UI + virus scan policy. Stubs in place.
- **Editable availability windows** — read-only grid today; inline editor lands alongside the schedule grid.
- **Per-agency local-time cron** — v1 runs in a single 12:00 UTC window. We need date-fns-tz to schedule per agency timezone.
- **Email channel for alerts** — alerts surface in-app only; Postmark integration deferred.
- **Virtualization on /clients and /caregivers** — naive scrolling today; will hurt above ~500 rows. Phase 7 perf pass.
- **Mailing-address inputs in the intake form** — gated by a checkbox but the field tree needs explicit registration before it's actually persisted on submit. Track it.
- **Address geocoding on update** — only happens on create today. Address edits should re-geocode (action exists; just needs wiring on `clients.update`).
- **Idle-session timeout** — Clerk session settings handle the session lifetime; we still owe a client-side idle detector (15 min) per spec §8.
- **Custom service codes on authorizations** — UI dropdown is curated; a "custom code" path is straightforward but isn't shipped.

## Debt / known sharp edges

- `convex/_generated/*` is hand-written in this branch because the build sandbox can't reach `api.convex.dev`. The Convex CLI overwrites these files cleanly on the first `pnpm convex:dev`; the headers say so. If a future PR forgets to re-run codegen after editing a Convex module, the api typing will lag. Adding a `pnpm convex:codegen` step to `prepare` is a one-line follow-up.
- `softDelete()` casts the patch through `any` because per-T patch typing for a polymorphic helper would require per-table specialization. The schema is the safety net (deleted* fields are declared on every table in `SoftDeletableTable`).
- React Hook Form + React Compiler emits one inert warning on `intake-form.tsx:62` (`watch()` is intentionally not memoization-safe). It's a warning, not an error; documented but not silenced.
- The Playwright happy-path spec (`tests/e2e/phase1-happy-path.spec.ts`) is a real test, but is `test.skip`-ped without `E2E=1` because it needs Clerk test-mode credentials + a live Convex deployment. CI runs the smoke spec only; the user should run the happy-path locally before tagging a release.
- We have not deployed to Fly.io. The build sandbox has no access. The user owes the staging deploy + a real signup smoke before declaring v0.1.0 fully shipped.

## Open questions still owed answers (spec §13)

1. NY-only v1 vs NY + MI from day one. (Built for both; trivial to flip.)
2. CDPAP support in v1 vs v2. (Schema flag exists; flow differences not yet exercised in clients.create.)
3. Pricing, branding, Spanish UI, Twilio number model, aggregator-credential handoff at onboarding, Fly.io region (us-east assumed).

## How to declare v0.1.0 fully done

1. Run `pnpm convex:dev` against a real deployment so codegen overwrites the hand-written stubs in `convex/_generated/`.
2. Run `E2E=1 pnpm test:e2e` against that deployment with Clerk test mode enabled.
3. Deploy to Fly.io us-east, set Convex/Clerk/PHI env vars, smoke a real signup.
4. Flip the docs to point at the staging URL.
5. `git tag v0.1.0` and push the tag.
