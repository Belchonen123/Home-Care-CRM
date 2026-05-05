"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewAuthorizationForm } from "./new-authorization-form";

interface Props {
  clientId: Id<"clients">;
  clientProgram: string;
}

export function AuthorizationsTab({ clientId, clientProgram }: Props) {
  const auths = useQuery(api.authorizations.listForClient, { clientId });
  const recompute = useMutation(api.authorizations.recomputeUsage);
  const remove = useMutation(api.authorizations.remove);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Authorizations</h2>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> New authorization
          </Button>
        )}
      </header>

      {adding && (
        <Card className="p-4">
          <NewAuthorizationForm
            clientId={clientId}
            clientProgram={clientProgram}
            onCancel={() => setAdding(false)}
            onCreated={() => setAdding(false)}
          />
        </Card>
      )}

      {auths === undefined && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      )}
      {auths && auths.length === 0 && !adding && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No authorizations yet. Add the first to start scheduling.
        </Card>
      )}

      {auths && auths.length > 0 && (
        <ol className="space-y-3">
          {auths.map((a) => (
            <li key={a._id}>
              <Card className="space-y-3 p-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {a.serviceCode}
                      {a.serviceDescription && (
                        <span className="ml-2 text-muted-foreground">
                          — {a.serviceDescription}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.payerName} ({a.payerKind}) · #{a.externalAuthNumber} ·{" "}
                      {format(new Date(a.startDate), "PP")} →{" "}
                      {format(new Date(a.endDate), "PP")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.daysToExpiry >= 0 && a.daysToExpiry <= 30 && (
                      <Badge variant={a.daysToExpiry <= 7 ? "destructive" : "warning"}>
                        Expires in {a.daysToExpiry}d
                      </Badge>
                    )}
                  </div>
                </header>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {a.consumedHours.toFixed(1)} / {a.authorizedHours.toFixed(1)} hours
                      ({a.consumedUnits} / {a.authorizedUnits} units)
                    </span>
                    <span>{a.utilizationPct}%</span>
                  </div>
                  <UtilizationBar pct={a.utilizationPct} />
                  <p className="text-xs text-muted-foreground">
                    {a.remainingHours.toFixed(1)} hours remaining
                  </p>
                </div>

                <footer className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void recompute({ authorizationId: a._id })}
                  >
                    <RefreshCw className="h-4 w-4" /> Recompute
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const reason = window.prompt("Reason for deletion?");
                      if (!reason) return;
                      void remove({ authorizationId: a._id, reason });
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </footer>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "success"
      : status === "draft"
        ? "secondary"
        : status === "paused"
          ? "warning"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function UtilizationBar({ pct }: { pct: number }) {
  const cls =
    pct >= 90
      ? "bg-destructive"
      : pct >= 75
        ? "bg-warning"
        : "bg-primary";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}
