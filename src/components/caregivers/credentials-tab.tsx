"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/onboarding/field-label";

const KIND_OPTIONS = [
  ["hha_certification", "HHA certification"],
  ["pca_certification", "PCA certification"],
  ["cna_certification", "CNA certification"],
  ["dcw_training", "DCW training (MI)"],
  ["cpr", "CPR"],
  ["first_aid", "First aid"],
  ["tb_test", "TB test"],
  ["physical", "Physical exam"],
  ["background_check", "Background check"],
  ["driver_license", "Driver license"],
  ["auto_insurance", "Auto insurance"],
  ["i9", "Form I-9"],
  ["w4", "Form W-4"],
  ["other", "Other"],
] as const;

type Kind = (typeof KIND_OPTIONS)[number][0];

export function CredentialsTab({ caregiverId }: { caregiverId: Id<"caregivers"> }) {
  const credentials = useQuery(api.credentials.listForCaregiver, { caregiverId });
  const create = useMutation(api.credentials.create);
  const remove = useMutation(api.credentials.remove);

  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Kind>("hha_certification");
  const [label, setLabel] = useState("");
  const [issuer, setIssuer] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    setSubmitting(true);
    try {
      await create({
        caregiverId,
        kind,
        label: label || undefined,
        issuer: issuer || undefined,
        documentNumber: documentNumber || undefined,
        issuedDate: issuedDate || undefined,
        expiresAt: expiresAt || undefined,
      });
      setAdding(false);
      setLabel("");
      setIssuer("");
      setDocumentNumber("");
      setIssuedDate("");
      setExpiresAt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add credential.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Credentials</h2>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add credential
          </Button>
        )}
      </header>

      {adding && (
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {KIND_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Issuer</Label>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Document number</Label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Issued date</Label>
              <Input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expires</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={add} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </Card>
      )}

      {credentials === undefined && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      )}
      {credentials && credentials.length === 0 && !adding && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No credentials yet. Add the first to start expiry tracking.
        </Card>
      )}

      {credentials && credentials.length > 0 && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_140px_120px_60px] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>Type</div>
            <div>Status</div>
            <div>Expires</div>
            <div>Issuer</div>
            <div></div>
          </div>
          <ol className="divide-y">
            {credentials.map((c) => (
              <li
                key={c._id}
                className="grid grid-cols-[1fr_120px_140px_120px_60px] items-center gap-3 px-4 py-3 text-sm"
              >
                <span>
                  {c.label || labelFor(c.kind)}
                  {c.documentNumber && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      #{c.documentNumber}
                    </span>
                  )}
                </span>
                <span>
                  <ExpiryBadge
                    status={c.expiryStatus as "no_expiry" | "expired" | "critical" | "warning" | "ok"}
                    days={c.daysUntilExpiry}
                  />
                </span>
                <span className="text-muted-foreground">
                  {c.expiresAt ? format(new Date(c.expiresAt), "PP") : "—"}
                </span>
                <span className="text-muted-foreground">{c.issuer ?? "—"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove({ credentialId: c._id })}
                  aria-label="Remove credential"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function labelFor(kind: string): string {
  return kind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ExpiryBadge({
  status,
  days,
}: {
  status: "no_expiry" | "expired" | "critical" | "warning" | "ok";
  days: number | null;
}) {
  if (status === "no_expiry") return <Badge variant="outline">No expiry</Badge>;
  if (status === "expired") return <Badge variant="destructive">Expired</Badge>;
  if (status === "critical")
    return <Badge variant="destructive">{days} day{days === 1 ? "" : "s"}</Badge>;
  if (status === "warning")
    return <Badge variant="warning">{days} days</Badge>;
  return <Badge variant="success">{days} days</Badge>;
}
