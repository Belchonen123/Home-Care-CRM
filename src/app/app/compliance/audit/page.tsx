"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { format, formatDistanceToNow } from "date-fns";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AuditRow = FunctionReturnType<typeof api.auditLog.list>[number];

const SINCE_OPTIONS: readonly { label: string; days: number }[] = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AuditLogPage() {
  const [sinceDays, setSinceDays] = useState(30);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const rows = useQuery(api.auditLog.list, { sinceDays, limit: 500 });

  const filtered = useMemo(() => {
    if (!rows) return [];
    const term = filter.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(term) ||
        (r.targetTable ?? "").toLowerCase().includes(term) ||
        (r.summary ?? "").toLowerCase().includes(term),
    );
  }, [rows, filter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Append-only. Every PHI access, mutation, and configuration change.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SINCE_OPTIONS.map((o) => (
            <Button
              key={o.days}
              size="sm"
              variant={o.days === sinceDays ? "default" : "outline"}
              onClick={() => setSinceDays(o.days)}
            >
              {o.label}
            </Button>
          ))}
          <Input
            placeholder="Filter action / table / summary"
            className="h-9 w-64"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </header>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[140px_140px_1fr_120px_120px] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div>When</div>
          <div>Actor</div>
          <div>Action</div>
          <div>Target</div>
          <div>Summary</div>
        </div>
        {!rows && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {rows && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No audit entries match these filters.
          </div>
        )}
        <ol className="divide-y">
          {filtered.map((r) => (
            <li key={r._id}>
              <button
                onClick={() => setSelected(r)}
                className="grid w-full grid-cols-[140px_140px_1fr_120px_120px] gap-3 px-4 py-2 text-left text-sm hover:bg-accent/40"
              >
                <span
                  className="text-muted-foreground"
                  title={format(new Date(r.at), "PPpp")}
                >
                  {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
                </span>
                <span>
                  <Badge variant="outline">{r.actorRole ?? "unknown"}</Badge>
                </span>
                <span className="font-mono text-xs">{r.action}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {r.targetTable ?? "—"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {r.summary ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Card>

      {selected && (
        <Card className="space-y-2 p-4">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Entry detail</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </header>
          <pre className="overflow-auto rounded-md bg-muted/40 p-3 text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
