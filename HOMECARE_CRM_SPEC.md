# Home Care CRM with EVV — Claude Code Project Spec

**Purpose of this doc.** This is the planning brief for Claude Code. It defines what we're building, the stack, the domain model, the EVV requirements, the build phases, and the acceptance criteria. Read this fully before writing any code. When in doubt, ask before assuming — most assumptions in this domain are wrong because state Medicaid rules differ in ways that aren't obvious from outside.

## 1. Project Summary

Build a multi-tenant home care CRM with built-in Electronic Visit Verification (EVV) for non-medical and Medicaid home care agencies operating in New York (HHAeXchange-aggregated MLTCs) and Michigan (CHAMPS / MDHHS Home Help). The system replaces or augments the agency-side workflow currently split across HHAeXchange/Sandata, scheduling spreadsheets, paper timesheets, and billing add-ons.

**Primary users:** intake coordinators, schedulers, billers, compliance staff, field caregivers, agency admins, and (read-only) MCO/case-manager portals.

**Business model assumption:** SaaS, per-agency subscription, priced per active client per month. Built so a single agency can onboard themselves; multi-tenant from day one.

**Non-goals for v1:**

- Direct 837P claim generation (we export to a clearinghouse instead).
- Clinical documentation (OASIS, Plan of Treatment 485). This is a non-medical / personal care CRM, not a Medicare Part A home health agency tool.
- Payroll processing. We export hours to a payroll provider.

## 2. Tech Stack (locked)

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui | Same stack as the rest of the portfolio. Server components for admin views, client components for scheduler. |
| Backend / DB | Convex | Realtime by default (schedule changes propagate to caregiver phones live), good auth story, transactional. |
| Auth | Convex Auth + Clerk (or WorkOS for SSO on enterprise tier) | Role-based, multi-tenant org switching. |
| Mobile (caregiver EVV) | Same Next.js app as a PWA for v1 (installable, geolocation, background sync). React Native only if v1 telemetry shows we need native location. | PWA gets us to market faster; geolocation API is sufficient for EVV check-in/out. |
| Telephony fallback (IVR for EVV) | Twilio Programmable Voice + Studio | Required because not every aide has a smartphone; many states require a non-smartphone option. |
| Voice / phone agents (later) | Retell | Future Maya-style intake agent integration. |
| Hosting | Fly.io (HIPAA BAA) | Already validated for HIPAA in your stack notes. |
| File storage | Convex file storage for in-app, S3 (with BAA) for long-term retention of compliance documents. | |
| Email / SMS | Postmark (transactional) + Twilio SMS | Caregiver reminders, missed-visit alerts. |
| Background jobs | Convex scheduled actions + crons | Daily aggregator submissions, missed-visit detection, authorization expiry alerts. |
| EDI / billing export | Generate 837P-ready CSV + a clearinghouse hand-off (Availity / Office Ally) in v2. v1 is CSV + PDF invoice. | |
| Observability | Sentry + Convex logs + Axiom (or just Convex for v1) | |
| Testing | Vitest, Playwright for the scheduler and EVV flows | EVV flows must be E2E-tested every release. |

**Hard rules:**

- No `any` in TypeScript. Convex schemas are the source of truth for types.
- No PHI in logs. No PHI in URLs (use IDs, not names). No PHI in error messages sent to the browser console.
- Every mutation that touches PHI writes to the audit log. Every query that reads PHI is rate-limited and access-checked.
- No external third-party scripts on any page that displays PHI (no Google Fonts loading from googleapis.com on those routes, no analytics that could exfiltrate).

## 3. Domain Glossary

| Term | Meaning |
| --- | --- |
| Client / Member / Consumer / Recipient | The person receiving care. Pick **Client** in code. UI labels can switch per-tenant ("Member" for MLTC-facing, "Consumer" for CDPAP). |
| Caregiver / Aide / HHA / PCA / DCW | The person providing care. Pick **Caregiver** in code. |
| Authorization | Approval from the payer (MLTC, MCO, MDHHS) to deliver X hours of Y service from date A to date B. Everything downstream — scheduling, billing — must respect this. |
| Plan of Care (POC) | The list of tasks/services the caregiver must perform on each visit, plus frequency. Issued by the case manager / RN supervisor. |
| Visit | A single scheduled or completed shift. Has scheduled start/end and (after EVV) actual start/end. |
| EVV | Electronic Visit Verification. Federal mandate (21st Century Cures Act, 2016) requiring 6 data points captured electronically for every Medicaid personal care and home health visit. |
| Aggregator | The state-level EVV system that all agencies must submit visits to. NY = HHAeXchange (MLTC-by-MLTC) + Sandata (state aggregator for some). MI = Sandata (CHAMPS submits via 1904 + EVV file). |
| CDPAP | Consumer Directed Personal Assistance Program (NY). Consumer is the employer of record; we still schedule and bill but the matching rules differ. |
| MLTC | Managed Long Term Care plan (NY MCOs that pay for personal care). Each has its own portal and billing rules. |
| MCO | Managed Care Organization. |
| CHAMPS | MI Medicaid provider portal. |
| MDHHS | Michigan Department of Health and Human Services. |
| Form 1904 | MI Home Help billing form. |
| EDI 837P | Professional claim format for electronic billing. |
| EDI 835 | Remittance advice (we receive these, parse to reconcile payments). |

## 4. Domain Model (Convex schema)

File: `convex/schema.ts`. All tables are tenant-scoped via `agencyId` except `agencies` and `users`.

**Schema rules:**

- Every PHI field that is stored encrypted at rest (SSN, DOB if standalone) is annotated and accessed via helper functions, never directly.
- Convex indexes: `(agencyId, status)` on every list view; `(agencyId, scheduledStart)` on visits for scheduler; `(agencyId, clientId, scheduledStart)` for client visit history.

## 5. EVV — The Heart of the System

The federal Cures Act mandate requires six data points for every visit. Build the system so you cannot complete a visit without them:

1. Type of service performed → `serviceCode` on the visit.
2. Individual receiving service → `clientId`.
3. Date of service → derived from `actualStart`.
4. Location of service → `clockInLocation` + `clockOutLocation` (lat/lng + accuracy).
5. Individual providing service → `caregiverId`, authenticated at clock-in.
6. Time the service begins and ends → `actualStart` + `actualEnd`.

### EVV capture methods (build all three)

**A. Mobile (PWA) — primary**

- Caregiver opens app, sees today's visits.
- Tap "Clock In" → request geolocation (must be `enableHighAccuracy: true, timeout: 10s, maximumAge: 0`).
- If outside a configurable radius from `serviceLocation` (default 500ft / ~150m), require a deviation reason.
- Capture device ID, accuracy, timestamp from server (never trust client clock for the official record — store both, but the server timestamp is authoritative).
- Offline mode: queue the clock-in/out with the captured GPS + local timestamp; sync when online; flag as "offline-captured" for review.

**B. Telephony / IVR (Twilio Studio flow)**

- Caregiver calls a dedicated agency number from the client's home phone.
- Phone number is matched against `clients.phones` to identify the visit.
- Caregiver enters their PIN.
- IVR confirms: "Press 1 to clock in for [Client First Name]." (No last name on the call — minimum necessary PHI.)
- Clock-out: same flow, plus task confirmation prompts pulled from the POC.
- Required because not every aide has a smartphone, and some states still require landline-based EVV as a fallback.

**C. FOB (token device) — v2 unless a customer demands it**

- Out of scope for v1. Document the data model so it slots in (`clockInMethod: "fob"`, store the FOB-generated code).

### EVV exception handling

A visit cannot be billed if EVV is incomplete or has an unresolved exception. Exceptions include:

- Missed visit (no clock-in by `scheduledStart + 30 min`).
- Late clock-in / early clock-out beyond tolerance.
- GPS outside radius.
- Missing client signature where required.
- Manual time edit by a scheduler (always requires a reason and an audit trail).

UI: a dedicated EVV Exceptions queue for compliance/scheduling staff. Every exception requires a reason code (configurable per agency) and a free-text note before it can be cleared.

### Aggregator submission

- Nightly cron submits all `evvStatus = ready` visits for the prior day to the configured aggregator(s) per client.
- HHAeXchange: their ingestion is per-MLTC and the format varies; abstract behind an `EvvAggregatorAdapter` interface (`submit(visits) → SubmissionResult`).
- Sandata Aggregator API: well-documented, REST-ish, OAuth.
- CHAMPS / MDHHS: file-based submission for some service types; we also produce 1904 PDFs for Home Help (you've already built the POC Builder — port that logic).
- Failures are retried with backoff and surfaced in a "Submission Health" dashboard.

## 6. Core Features (build in this order)

### Phase 1 — Foundation (weeks 1–3)

1. Multi-tenant auth (Clerk + Convex), org switching, role-based access.
2. Agency onboarding wizard (states, programs, provider IDs, billing contact).
3. Clients CRUD, including intake form, addresses with geocoding (Mapbox or Google Places), document uploads.
4. Caregivers CRUD, including credential tracking with expiry alerts (cron: 30/14/7 days out).
5. Authorizations CRUD, linked to clients, with hours-remaining counters.
6. Audit log (every mutation, append-only).

**Acceptance:** A new agency can sign up, add 3 clients, 3 caregivers, 1 authorization per client, and see expiry alerts fire on a backdated certification.

### Phase 2 — Scheduling (weeks 4–6)

- Plan of Care builder (tasks from a service-code-specific catalog; custom additions allowed).
- Weekly schedule grid (clients on rows, days on columns, drag-to-create visits). Use virtualization (TanStack Virtual or react-window) — agencies with 200+ clients break naive grids.
- Caregiver-side day view (list of upcoming + in-progress visits).
- Authorization-first placement model (port from your MDHHS POC Builder work): when creating a visit, validate that authorized hours remain and that the assigned caregiver is qualified. Block, don't warn-and-allow.
- Caregiver-client matching helpers: filter by language, gender preference, distance from caregiver address, certification, availability window, no overtime conflicts.
- Recurring schedule templates ("MWF 9–1 with Maria for the next 90 days"); generate concrete visits as the window rolls forward.
- Conflict detection: caregiver double-booked, client double-booked, caregiver outside availability, authorization exhausted.

**Acceptance:** Schedule a 4-week recurring visit pattern in under 30 seconds. Authorization counter decrements correctly. Attempting to overbook surfaces a blocking error with a remediation suggestion.

### Phase 3 — EVV Capture (weeks 7–9)

- Caregiver PWA (installable, push notifications for upcoming visits).
- Mobile clock-in/out with GPS, geofence validation, offline queue.
- Task checklist on the visit screen (driven by POC).
- Client signature capture on visit completion (canvas signature pad).
- IVR flow in Twilio Studio with PIN auth, visit identification by caller ID, task confirmation by DTMF.
- Real-time visit status board for schedulers (live via Convex subscriptions): scheduled / clocked-in / clocked-out / missed / late.

**Acceptance:** A caregiver can complete a visit start-to-finish on a $200 Android phone from inside a client's home, including a 5-minute offline gap, and the visit shows up in the office dashboard with all 6 EVV data points and a clean exception status.

### Phase 4 — EVV Submission & Exceptions (weeks 10–11)

- `EvvAggregatorAdapter` interface + first concrete implementation (Sandata, since it's the cleanest API).
- Exception queue UI with bulk actions.
- Nightly submission cron + Submission Health dashboard.
- HHAeXchange adapter (per-MLTC variants behind a config table).

**Acceptance:** A day's worth of completed visits submits to the aggregator successfully, partially-failed batches surface specific visit-level errors with remediation paths, and a re-submit action works end-to-end.

### Phase 5 — Billing (weeks 12–14)

- Per-visit charge calculation from contract rates, with overtime + holiday rules.
- Invoice generation per client per billing period (weekly or biweekly per payer).
- Export: PDF invoice, billing-ready CSV, and an 837P-shaped JSON that downstream clearinghouses can ingest. (Full 837P EDI generation is v2 — for v1 we hand off to Office Ally / Availity.)
- 835 import + auto-reconciliation. Manual reconciliation UI for unmatched lines.
- Aging report (0–30, 31–60, 61–90, 90+).

**Acceptance:** Run a billing period for one client end-to-end, produce an invoice, mark it submitted, import an 835 that pays it in full, and see balance go to zero.

### Phase 6 — Compliance & Reporting (weeks 15–16)

- Credential expiry dashboard.
- Authorization-utilization dashboard (under/over-using authorized hours, by client, by week).
- Missed visit report.
- Caregiver hour reports for payroll export (CSV).
- Audit log search UI (compliance-only).
- State-specific report templates: NY MLTC monthly utilization, MI MDHHS-6064-P / 1904.

### Phase 7 — Polish (weeks 17–18)

- Performance pass on the scheduler (target: 60fps drag with 500 visits visible).
- Penetration test prep.
- Onboarding tour, empty states, error states, loading states.
- HIPAA risk assessment + BAA template + breach notification runbook.

## 7. User Roles & Permissions

| Role | Clients | Caregivers | Auths | Schedule | Visits/EVV | Billing | Compliance | Settings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Owner | RW | RW | RW | RW | RW | RW | RW | RW |
| Admin | RW | RW | RW | RW | RW | RW | RW | R |
| Scheduler | RW | R | R | RW | RW (own agency) | — | — | — |
| Intake | RW | — | RW | R | R | — | — | — |
| Biller | R | R | R | R | R | RW | R | — |
| Compliance | R | R | R | R | RW (exceptions only) | R | RW | — |
| Caregiver | R (assigned only, minimum-necessary fields) | R (self) | R (relevant only) | R (own visits) | RW (own visits, clock-in/out, notes) | — | — | — |
| Viewer | R | R | R | R | R | R | R | — |

**Implementation:** `requireRole()` and `requirePermission()` helpers in Convex actions/mutations, with a thin `withAccessCheck(query)` wrapper. No client-side enforcement is trusted.

## 8. Compliance Requirements

- **HIPAA.** Encryption at rest (Convex provides this; we additionally encrypt SSN/DOB at the field level), encryption in transit (TLS 1.2+), audit log on every read/write of PHI, automatic session timeout (15 min idle for staff, configurable), forced re-auth for sensitive actions (rate changes, mass deletes, exports).
- **21st Century Cures Act EVV.** See section 5.
- **NY-specific.** HHAeXchange aggregator submission, MLTC-specific billing rules, CDPAP consumer-as-employer flag (changes which fields are required and which validations apply).
- **MI-specific.** CHAMPS provider ID, 1904 form generation, MDHHS Home Help task categories matching authorized minutes (your POC Builder logic).
- **Data retention.** 7 years minimum on visit records and billing (CMS rule). Soft-delete only; hard-delete requires owner role + reason + audit entry.
- **Breach notification.** Documented runbook: detection → containment → assessment → notification (within 60 days for HIPAA; sooner for some state laws). Build the capability in v1, even if the runbook is just a doc.

## 9. File Structure

```
.
├── HOMECARE_CRM_SPEC.md
├── CLAUDE.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
├── .env.example
├── .nvmrc
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── prettier.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── .github/workflows/
│   ├── ci.yml
│   └── e2e.yml
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (marketing)/      # public, no PHI
│   │   ├── (auth)/           # sign-in, sign-up
│   │   ├── (app)/            # authenticated app shell
│   │   ├── api/              # route handlers (Twilio, Clerk webhook)
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/               # shadcn primitives
│   │   ├── shell/            # sidebar, topbar, command palette
│   │   ├── clients/
│   │   ├── caregivers/
│   │   ├── scheduling/
│   │   └── evv/
│   ├── lib/                  # browser/server-shared utilities
│   └── tests/                # vitest co-located unit tests
├── convex/
│   ├── schema.ts             # source of truth for types
│   ├── lib/                  # access, audit, crypto, dates
│   ├── agencies.ts
│   ├── clients.ts
│   ├── caregivers.ts
│   ├── credentials.ts
│   ├── authorizations.ts
│   ├── plansOfCare.ts
│   ├── visits.ts
│   ├── evvSubmissions.ts
│   ├── alerts.ts
│   ├── auditLog.ts
│   ├── crons.ts
│   ├── http.ts               # webhooks
│   └── _generated/
└── tests/e2e/                # Playwright
```

## 10. UX Principles

- **Schedulers live in the schedule grid.** Optimize for keyboard, not mouse. Cmd+K command palette. Drag, but also arrow-keys + enter.
- **Caregivers are tired.** Big tap targets, two taps to clock in, no scrolling required to find today's visit.
- **Compliance staff need history, not noise.** Every entity has a Timeline tab. Don't make them dig through audit logs.
- **Billers need totals, then drill-down.** Every report opens at the summary; every cell is clickable to the visit-level detail.
- **Empty states are onboarding.** First-run for an agency should walk them through adding a client, caregiver, authorization, and scheduling a first visit in under 10 minutes.

Don't ship anything that looks like a generic admin template. Use a confident type scale, real spacing, restrained color (green for success/clocked-in, amber for at-risk visits, red only for blocking errors). Read the frontend-design skill before you commit a UI PR.

## 11. Acceptance Criteria for v1 (the MVP gate)

A new agency can, within one business day of signup, do all of the following without help:

1. Sign up, complete onboarding, add their NPI/CHAMPS/HHAX IDs.
2. Add 10 real clients with addresses, authorizations, and plans of care.
3. Add 10 caregivers with credentials and availability.
4. Build a recurring weekly schedule.
5. Have a caregiver clock in and out via the PWA, with GPS, signature, and task completion.
6. See the visit on the live board in real time.
7. Resolve at least one EVV exception.
8. Submit a day's visits to the configured aggregator.
9. Generate an invoice for one client for one billing week.
10. Export caregiver hours for payroll.

If any of those takes more than the time a human would expect, fix it before calling v1 done.

## 12. Development Conventions for Claude Code

- Branch per phase. PR per feature. Squash merge.
- Every PR includes: tests, a screenshot or Loom link if UI changed, and a one-line entry in `CHANGELOG.md`.
- TypeScript strict mode, no `any`, no `// @ts-ignore` without a comment explaining why.
- Convex functions: `query` for reads, `mutation` for writes, `action` only when calling external APIs. Don't put business logic in actions if a mutation will do.
- Validation at the boundary. Use Zod (or Convex validators) for every external input. Never trust the client.
- Errors: throw `ConvexError` with a typed code, surface user-friendly messages in the UI from a code map, never leak stack traces.
- Tests: scheduler conflict detection, EVV geofence logic, authorization-hours math, billing-rate calculation, and the IVR flow are all unit-tested. EVV end-to-end has a Playwright test.
- Commit messages: conventional commits (`feat(scheduler):`, `fix(evv):`).

**Before starting any phase, Claude Code must:**

- Re-read this spec.
- Confirm the prior phase's acceptance criteria are met.
- Open a planning issue listing the tasks for the phase, get confirmation, then build.

**Do not, under any circumstances:**

- Use mock data in places where real data should flow (this has bitten the Cursor portfolio work — see the lessons-learned file).
- Drift to deprecated API versions of Convex, Twilio, or Clerk. Pin versions in `package.json`. Re-check the docs at the start of each phase.
- Ship a feature that touches PHI without a corresponding audit-log entry and access check.
- Build a "demo mode" that disables auth. There is no demo mode. Use a sandbox tenant with synthetic data.

## 13. Open Questions (resolve with Ben before starting)

- Initial target market — both NY and MI from day one, or NY-only for v1 with MI as v2?
- CDPAP support in v1, or v2? (Adds consumer-as-employer flows + different EVV story.)
- Pricing — per active client per month, or per visit, or flat tiers?
- Branding / product name.
- Do we need Spanish caregiver UI from v1? (Likely yes for NY.)
- Twilio numbers: one per agency, or one shared with PIN-based agency selection?
- Aggregator credentials — how do agencies hand them to us at onboarding?
- Hosting region — us-east for HIPAA, but Fly.io has multiple. Pick one and document.

## 14. Reference Material to Cite, Not Memorize

When implementing, do not rely on training-data memory for any of these — fetch and read the current docs:

- 21st Century Cures Act EVV requirements (CMS).
- HHAeXchange EVV API + each MLTC's specific submission rules.
- Sandata Aggregator API documentation.
- MDHHS CHAMPS billing manual, Form 1904 spec, MDHHS-6064-P task categories.
- HIPAA Security Rule technical safeguards.
- ANSI X12 837P implementation guide (when v2 EDI lands).

This domain changes. The agencies that lose money are the ones that built against last year's rules.

**End of spec.** Build phase 1 first. Ask questions early. Ship the boring parts well — billing and EVV — before building the cool parts.
