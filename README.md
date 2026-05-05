# Home Care CRM

Multi-tenant home-care CRM with Electronic Visit Verification (EVV) for non-medical
and Medicaid agencies in New York and Michigan. Built on Next.js 16 + Convex +
Clerk + Tailwind 4.

The product spec lives in [`HOMECARE_CRM_SPEC.md`](./HOMECARE_CRM_SPEC.md);
[`CLAUDE.md`](./CLAUDE.md) summarizes the hard rules.

## Develop

```bash
nvm use            # Node 20 LTS (see .nvmrc)
corepack enable    # pnpm 9
pnpm install
cp .env.example .env.local && $EDITOR .env.local
pnpm dev           # http://localhost:3000
```

In a second terminal: `pnpm convex:dev`. Run `pnpm lint && pnpm typecheck && pnpm test`
before opening a PR. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for everything else.
