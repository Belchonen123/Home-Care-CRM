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
  { value: "intake", label: "Intake" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "discharged", label: "Discharged" },
] as const;

export default function ClientsListPage() {
  const [statusFilter, setStatusFilter] = useState<
    "intake" | "active" | "on_hold" | "discharged" | undefined
  >(undefined);
  const [search, setSearch] = useState("");

  const clients = useQuery(api.clients.list, {
    statusFilter,
    search: search || undefined,
    limit: 200,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People receiving care. Add, edit, and review intake.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/clients/new">
            <Plus className="h-4 w-4" /> New client
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or Medicaid ID"
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

      {clients === undefined && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      )}

      {clients && clients.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {search || statusFilter
              ? "No clients match these filters."
              : "No clients yet. Add your first to get started."}
          </p>
          {!search && !statusFilter && (
            <Button asChild className="mt-4">
              <Link href="/app/clients/new">Add a client</Link>
            </Button>
          )}
        </Card>
      )}

      {clients && clients.length > 0 && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_180px] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>Name</div>
            <div>Status</div>
            <div>Program</div>
            <div>Service area</div>
          </div>
          <ol className="divide-y">
            {clients.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/app/clients/${c._id}`}
                  className="grid grid-cols-[1fr_120px_120px_180px] gap-3 px-4 py-3 text-sm hover:bg-accent/40"
                >
                  <span className="font-medium">
                    {c.firstName} {c.lastName}
                    {c.preferredName && (
                      <span className="ml-1 text-muted-foreground">
                        ({c.preferredName})
                      </span>
                    )}
                  </span>
                  <span>
                    <StatusBadge status={c.status} />
                  </span>
                  <span className="text-muted-foreground">{c.program}</span>
                  <span className="text-muted-foreground">
                    {c.city}, {c.stateCode}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "intake" | "active" | "on_hold" | "discharged" }) {
  const variant =
    status === "active"
      ? "success"
      : status === "intake"
        ? "secondary"
        : status === "on_hold"
          ? "warning"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
