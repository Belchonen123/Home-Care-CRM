"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { Plus, Search } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "applicant", label: "Applicant" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Terminated" },
] as const;

export default function CaregiversListPage() {
  const [statusFilter, setStatusFilter] = useState<
    "applicant" | "active" | "inactive" | "terminated" | undefined
  >(undefined);
  const [search, setSearch] = useState("");

  const caregivers = useQuery(api.caregivers.list, {
    statusFilter,
    search: search || undefined,
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caregivers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Field staff. Track classifications, certifications, and availability.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/caregivers/new">
            <Plus className="h-4 w-4" /> New caregiver
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="h-9 w-72 pl-9"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={f.value === statusFilter ? "default" : "outline"}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {caregivers === undefined && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      )}

      {caregivers && caregivers.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {search || statusFilter
              ? "No caregivers match these filters."
              : "No caregivers yet. Add your first."}
          </p>
          {!search && !statusFilter && (
            <Button asChild className="mt-4">
              <Link href="/app/caregivers/new">Add a caregiver</Link>
            </Button>
          )}
        </Card>
      )}

      {caregivers && caregivers.length > 0 && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_1fr_140px] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>Name</div>
            <div>Status</div>
            <div>Classifications</div>
            <div>Phone</div>
          </div>
          <ol className="divide-y">
            {caregivers.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/app/caregivers/${c._id}`}
                  className="grid grid-cols-[1fr_120px_1fr_140px] gap-3 px-4 py-3 text-sm hover:bg-accent/40"
                >
                  <span className="font-medium">
                    {c.firstName} {c.lastName}
                  </span>
                  <span>
                    <StatusBadge status={c.status} />
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {c.classifications.map((k) => (
                      <Badge key={k} variant="outline" className="uppercase">
                        {k}
                      </Badge>
                    ))}
                  </span>
                  <span className="text-muted-foreground">{c.phone}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "applicant" | "active" | "inactive" | "terminated";
}) {
  const variant =
    status === "active"
      ? "success"
      : status === "applicant"
        ? "secondary"
        : status === "inactive"
          ? "warning"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
