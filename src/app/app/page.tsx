import Link from "next/link";

const STUB_METRICS = [
  { label: "Active clients", value: "—", href: "/app/clients" as const },
  { label: "Active caregivers", value: "—", href: "/app/caregivers" as const },
  { label: "Visits today", value: "—", href: "/app/visits" as const },
  { label: "EVV exceptions", value: "—", href: "/app/compliance" as const },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live agency snapshot. Real numbers populate as Phase 1 features land.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STUB_METRICS.map((m) => (
          <li
            key={m.label}
            className="rounded-lg border bg-card p-5 transition-colors hover:bg-accent/40"
          >
            <Link href={m.href} className="block">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.label}
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{m.value}</div>
            </Link>
          </li>
        ))}
      </ul>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">Welcome.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Onboard your agency, add clients and caregivers, capture authorizations,
          schedule visits, and verify EVV. Each section is reachable from the
          sidebar; empty states walk you through the first action.
        </p>
      </section>
    </div>
  );
}
