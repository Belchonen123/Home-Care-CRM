"use client";

import { format } from "date-fns";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";

type Client = NonNullable<FunctionReturnType<typeof api.clients.get>>;

export function OverviewTab({ client }: { client: Client }) {
  const sa = client.serviceAddress;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Identity</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row k="DOB" v={client.dobMonthDay ? `(month-day only) ${client.dobMonthDay}` : "—"} />
          <Row k="SSN" v={client.ssnPresent ? "On file (masked)" : "—"} />
          <Row k="Medicaid ID" v={client.medicaidId ?? "—"} />
          <Row k="Medicare ID" v={client.medicareId ?? "—"} />
          <Row
            k="Languages"
            v={client.languages.length ? client.languages.join(", ") : "—"}
          />
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Address &amp; contact</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row
            k="Service"
            v={`${sa.line1}${sa.line2 ? `, ${sa.line2}` : ""}, ${sa.city}, ${sa.state} ${sa.postalCode}`}
          />
          {client.phones.map((p, i) => (
            <Row key={i} k={p.kind} v={p.e164} />
          ))}
          <Row k="Email" v={client.email ?? "—"} />
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Care</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row
            k="Start of care"
            v={
              client.startOfCareDate
                ? format(new Date(client.startOfCareDate), "PP")
                : "—"
            }
          />
          <Row k="Active authorizations" v={String(client.activeAuthorizationCount)} />
          <Row k="Total authorizations" v={String(client.authorizationCount)} />
          <Row
            k="Last visit"
            v={
              client.lastVisitAt
                ? format(new Date(client.lastVisitAt), "PP")
                : "No visits yet"
            }
          />
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Case manager</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row k="Name" v={client.caseManagerName ?? "—"} />
          <Row k="Email" v={client.caseManagerEmail ?? "—"} />
          <Row k="Phone" v={client.caseManagerPhone ?? "—"} />
        </dl>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
}
