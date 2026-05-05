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
import { CaregiverOverview } from "@/components/caregivers/overview-tab";
import { CredentialsTab } from "@/components/caregivers/credentials-tab";
import { AvailabilityTab } from "@/components/caregivers/availability-tab";
import { CaregiverTimeline } from "@/components/caregivers/timeline";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "credentials", label: "Credentials" },
  { id: "availability", label: "Availability" },
  { id: "assignments", label: "Assignments" },
  { id: "pay", label: "Pay & Tax" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
] as const;

export default function CaregiverDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const caregiverId = id as Id<"caregivers">;
  const caregiver = useQuery(api.caregivers.get, { caregiverId });
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  if (caregiver === undefined) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (caregiver === null) {
    return (
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/caregivers">
            <ChevronLeft className="h-4 w-4" /> Back to caregivers
          </Link>
        </Button>
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Caregiver not found.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/caregivers">
            <ChevronLeft className="h-4 w-4" /> Back to caregivers
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {caregiver.firstName} {caregiver.lastName}
            {caregiver.preferredName && (
              <span className="ml-2 text-muted-foreground">
                ({caregiver.preferredName})
              </span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{caregiver.status}</Badge>
            <Badge variant="outline">{caregiver.employmentType}</Badge>
            {caregiver.classifications.map((k) => (
              <Badge key={k} variant="outline" className="uppercase">
                {k}
              </Badge>
            ))}
          </p>
        </div>
      </header>

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(id) => setTab(id as (typeof TABS)[number]["id"])}
      />

      {tab === "overview" && <CaregiverOverview caregiver={caregiver} />}
      {tab === "credentials" && <CredentialsTab caregiverId={caregiverId} />}
      {tab === "availability" && (
        <AvailabilityTab caregiver={caregiver} />
      )}
      {tab === "assignments" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Assignments land in Phase 2 (scheduling).
        </Card>
      )}
      {tab === "pay" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Pay rates &amp; tax forms — extended fields land alongside Phase 5
          (billing &amp; payroll).
        </Card>
      )}
      {tab === "documents" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Document uploads land in a follow-up commit.
        </Card>
      )}
      {tab === "timeline" && <CaregiverTimeline caregiverId={caregiverId} />}
    </div>
  );
}
