"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/clients/tabs";
import { ClientTimeline } from "@/components/clients/timeline";
import { OverviewTab } from "@/components/clients/overview-tab";
import { AuthorizationsTab } from "@/components/clients/authorizations-tab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "authorizations", label: "Authorizations" },
  { id: "plan-of-care", label: "Plan of Care" },
  { id: "visits", label: "Visits" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
] as const;

export default function ClientDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const clientId = id as Id<"clients">;
  const client = useQuery(api.clients.get, { clientId });
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  if (client === undefined) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (client === null) {
    return (
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/clients">
            <ChevronLeft className="h-4 w-4" /> Back to clients
          </Link>
        </Button>
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Client not found.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/clients">
            <ChevronLeft className="h-4 w-4" /> Back to clients
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.firstName} {client.lastName}
            {client.preferredName && (
              <span className="ml-2 text-muted-foreground">({client.preferredName})</span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{client.program}</Badge>
            <Badge variant="secondary">{client.status}</Badge>
            {client.isCdpapConsumer && <Badge variant="outline">CDPAP consumer</Badge>}
          </p>
        </div>
      </header>

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(id) => setTab(id as (typeof TABS)[number]["id"])}
      />

      {tab === "overview" && <OverviewTab client={client} />}
      {tab === "authorizations" && (
        <AuthorizationsTab clientId={clientId} clientProgram={client.program} />
      )}
      {tab === "plan-of-care" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Plan of Care lands in Phase 2.
        </Card>
      )}
      {tab === "visits" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Visits land in Phase 2.
        </Card>
      )}
      {tab === "documents" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Document uploads land in a Prompt 7 follow-up commit.
        </Card>
      )}
      {tab === "timeline" && (
        <ClientTimeline clientId={clientId} />
      )}
    </div>
  );
}
