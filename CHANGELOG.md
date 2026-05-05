# Changelog

All notable changes to this project will be documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-05

The Phase 1 foundation. See [`PHASE1-RETRO.md`](./PHASE1-RETRO.md) for the
acceptance check, what shipped, what's deferred, and known sharp edges.

### Added

- **Repo & tooling.** Next 16 (App Router, React 19), Tailwind 4 (CSS config),
  Convex 1.37, ESLint 9 flat config + Prettier, Vitest, Playwright, Husky +
  lint-staged, GitHub Actions (lint + typecheck + unit on PR; Playwright on
  main). All deps pinned to exact versions. Node 20 LTS via `.nvmrc`,
  pnpm 9 via `packageManager`.
- **Schema.** All 16 domain tables from spec §4 with a documented index map at
  the top of `convex/schema.ts`. Soft-delete (`deletedAt`/`deletedBy`/
  `deletedReason`) on every PHI-bearing table. PHI fields (SSN, full DOB)
  encrypted at rest with AES-256-GCM via WebCrypto.
- **Auth + access.** Clerk + Convex Auth integration. Clerk Organizations map
  to agencies. `getIdentity`, `requireMembership`, `requirePermission`,
  `requireRole` helpers + the full role × permission matrix from spec §7.
- **Audit log.** Append-only `auditLog` with `logAudit()` helper. Every PHI
  mutation emits a row. `phi.read.ssn` audit on privileged decrypt.
  Compliance-only `/app/compliance/audit` UI with time filters, action
  prefix filter, and JSON detail drawer.
- **Onboarding.** Six-step wizard (basics → states/programs → provider IDs →
  contacts → BAA → review). URL-persisted state, zod schemas shared
  client/server, CMS-correct NPI Luhn checksum, BAA acknowledgment
  receipt with timestamp + IP captured to the audit log.
- **Clients.** List with status filters + search. Full intake form
  (Identity, Program, Service + optional Mailing addresses, Phones
  with EVV-IVR-source flag, Emergency Contacts with primary-uniqueness,
  Case Manager, Notes). Detail with tabs Overview, Authorizations,
  Plan of Care (stub), Visits (stub), Documents (stub), Timeline (live
  audit feed scoped to the client).
- **Caregivers.** List, intake, detail with tabs Overview, Credentials,
  Availability (read-only weekly grid), Assignments (stub), Pay & Tax
  (stub), Documents (stub), Timeline. Credentials sub-feature: per-row
  expiry badge color-coded by status, audited add + remove.
- **Authorizations.** Per-client list on the client detail page with
  utilization progress bar (color-coded by threshold). Inline
  new-auth form with service-code catalog filtered by program (T1019,
  T1020, S5125, S5130, S9122, T2025), MI MDHHS-6064-P task-category
  table with live-total validation, weekly + monthly caps. `recomputeUsage`
  walks completed visits to derive consumed units.
- **Daily crons.** Credential expiry alerts at 30/14/7 days + on expiry
  (deduped via `credentials.alertsSent`). Authorization expiry alerts
  at 30/14/7 days + 90% utilization (deduped per auth × kind).
  Auto-flip authorizations to `status=expired` once `endDate` passes.
- **Notifications.** Top-bar bell-icon dropdown with unread count, severity
  dots, per-row dismiss, mark-all-as-read.
- **Project docs.** `HOMECARE_CRM_SPEC.md` (source of truth), `CLAUDE.md`,
  `CONTRIBUTING.md`, `README.md`, `PHASE1-RETRO.md`, `.env.example`.

### Tests

- 23 unit tests across crypto round-trip + tamper detection, access
  permission matrix, ISO date math, MI task-category validation, and
  credential expiry classification.
- Playwright smoke (home page) on every push.
- Playwright Phase 1 happy-path skeleton (skipped without `E2E=1`).
