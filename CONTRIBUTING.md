# Contributing

The product spec is [`HOMECARE_CRM_SPEC.md`](./HOMECARE_CRM_SPEC.md). The hard
rules — strict TS, no PHI in logs/URLs/errors, audit+access on every PHI
mutation, no third-party scripts on PHI pages — are summarized in
[`CLAUDE.md`](./CLAUDE.md). Re-read both before opening a PR.

## Toolchain

- **Node 20 LTS** (pinned in `.nvmrc`). Use `nvm use` or `fnm use`.
- **pnpm 9** via `corepack enable` (`packageManager` field in `package.json`).
- **TypeScript 5** strict; `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`.
- **Tailwind 4** with CSS-based config (`src/app/globals.css`). No
  `tailwind.config.ts`.

## Dependency-pinning policy

Every dependency in `package.json` is pinned to an exact version (no `^`, no
`~`). Reasons:

1. The home-care domain is regulatory; reproducible builds matter for audit.
2. Convex, Clerk, and Twilio APIs have shifted in breaking ways in the past
   year. Pinning surfaces the upgrade as an explicit, reviewed PR.
3. Phase prompts require re-reading official docs before each phase; the
   matching version bump lands in the same change.

When upgrading, **pin to the exact version** you tested against and add a line
to `CHANGELOG.md` describing why.

## Running locally

```bash
nvm use
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
# in another terminal:
pnpm convex:dev
```

## Tests

- `pnpm test` — Vitest unit tests (`src/**/*.{test,spec}.ts(x)`,
  `convex/**/*.{test,spec}.ts`).
- `pnpm test:e2e` — Playwright (chromium + Pixel 7 viewport).
- `pnpm lint` — ESLint flat config (`@eslint/js`, typescript-eslint strict,
  next/core-web-vitals, prettier).
- `pnpm typecheck` — `tsc --noEmit`.

A pre-commit hook runs `lint-staged` (ESLint --fix, Prettier --write).

## Branching & PRs

- Branch per phase (`claude/home-care-crm-evv-…`); PR per feature, squash merge.
- Conventional commits: `feat(scheduler):`, `fix(evv):`, `chore(deps):`, etc.
- Every PR: tests + UI screenshot if the surface changed + a one-line
  `CHANGELOG.md` entry under `[Unreleased]`.

## File layout

See spec §9.

## Security & PHI

- Never log full names, SSNs, DOBs, or addresses. Use record IDs.
- Never put PHI in URLs (use IDs, not names). Never include PHI in error
  messages surfaced to the browser console.
- Field-level encryption for SSN and standalone DOB lives in
  `convex/lib/crypto.ts` (added in Prompt 2). The encryption key is loaded
  from `PHI_ENCRYPTION_KEY` (32 bytes, base64).
- All PHI-touching mutations call `withAudit(...)` (added in Prompt 4). All
  PHI-reading queries go through `requirePermission(...)`.

If you spot a violation of any of the above in a PR, request changes — even on
your own work.
