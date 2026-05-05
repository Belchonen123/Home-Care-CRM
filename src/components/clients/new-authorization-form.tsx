"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MI_TASK_CATEGORIES, SERVICE_CODES } from "@/lib/service-codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/onboarding/field-label";

interface Props {
  clientId: Id<"clients">;
  clientProgram: string;
  onCancel: () => void;
  onCreated: () => void;
}

export function NewAuthorizationForm({
  clientId,
  clientProgram,
  onCancel,
  onCreated,
}: Props) {
  const payers = useQuery(api.payers.list, { activeOnly: true });
  const create = useMutation(api.authorizations.create);

  const isMiHomeHelp = clientProgram === "mi_home_help";
  const codes = useMemo(
    () =>
      SERVICE_CODES.filter((c) =>
        c.programs.includes(clientProgram as (typeof c.programs)[number]),
      ),
    [clientProgram],
  );

  const [payerId, setPayerId] = useState<Id<"payers"> | "">("");
  const [externalAuthNumber, setExternalAuthNumber] = useState("");
  const [serviceCode, setServiceCode] = useState(codes[0]?.code ?? "T1019");
  const [serviceDescription, setServiceDescription] = useState(codes[0]?.label ?? "");
  const [unitMinutes, setUnitMinutes] = useState(codes[0]?.defaultUnitMinutes ?? 15);
  const [authorizedUnits, setAuthorizedUnits] = useState(160); // 40h/week × 4 weeks
  const [weeklyMaxUnits, setWeeklyMaxUnits] = useState<number | undefined>(undefined);
  const [monthlyMaxUnits, setMonthlyMaxUnits] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [diagnoses, setDiagnoses] = useState("");
  const [notes, setNotes] = useState("");
  const [taskMinutes, setTaskMinutes] = useState<Record<string, number>>(
    isMiHomeHelp ? Object.fromEntries(MI_TASK_CATEGORIES.map((c) => [c, 0])) : {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedTaskTotal = (monthlyMaxUnits ?? authorizedUnits) * unitMinutes;
  const actualTaskTotal = Object.values(taskMinutes).reduce((a, n) => a + (n || 0), 0);

  function setCode(code: string) {
    setServiceCode(code);
    const c = SERVICE_CODES.find((x) => x.code === code);
    if (c) {
      setServiceDescription(c.label);
      setUnitMinutes(c.defaultUnitMinutes);
    }
  }

  async function submit() {
    setError(null);
    if (!payerId) {
      setError("Choose a payer.");
      return;
    }
    if (!externalAuthNumber || !startDate || !endDate) {
      setError("Auth number, start, and end are required.");
      return;
    }
    if (
      isMiHomeHelp &&
      Object.values(taskMinutes).some((n) => n > 0) &&
      actualTaskTotal !== expectedTaskTotal
    ) {
      setError(
        `MI Home Help: task-category minutes must total ${expectedTaskTotal} (got ${actualTaskTotal}).`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await create({
        clientId,
        payerId: payerId as Id<"payers">,
        externalAuthNumber,
        serviceCode,
        serviceDescription: serviceDescription || undefined,
        startDate,
        endDate,
        unitMinutes,
        authorizedUnits,
        weeklyMaxUnits,
        monthlyMaxUnits,
        diagnoses: diagnoses
          .split(/[\s,]+/)
          .map((d) => d.trim())
          .filter(Boolean),
        miTaskCategoryMinutes:
          isMiHomeHelp && Object.values(taskMinutes).some((n) => n > 0)
            ? Object.entries(taskMinutes)
                .filter(([, m]) => m > 0)
                .map(([category, minutes]) => ({ category, minutes }))
            : undefined,
        notes: notes || undefined,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create authorization.");
    } finally {
      setSubmitting(false);
    }
  }

  if (payers === undefined) {
    return <p className="text-sm text-muted-foreground">Loading payers…</p>;
  }

  if (payers.length === 0) {
    return (
      <div className="space-y-3 rounded-md border border-dashed p-4 text-sm">
        <p>No active payers configured yet.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/settings">Add a payer in Settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">New authorization</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Payer" required>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value as Id<"payers"> | "")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Choose payer —</option>
            {payers.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.kind})
              </option>
            ))}
          </select>
        </Field>
        <Field label="External auth number" required>
          <Input
            value={externalAuthNumber}
            onChange={(e) => setExternalAuthNumber(e.target.value)}
            placeholder="MLTC-123456"
          />
        </Field>
        <Field label="Service code" required>
          <select
            value={serviceCode}
            onChange={(e) => setCode(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {codes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <Input
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
          />
        </Field>
        <Field label="Unit length (min)" required>
          <Input
            type="number"
            value={unitMinutes}
            onChange={(e) => setUnitMinutes(Number(e.target.value))}
          />
        </Field>
        <Field label="Authorized units" required>
          <Input
            type="number"
            value={authorizedUnits}
            onChange={(e) => setAuthorizedUnits(Number(e.target.value))}
          />
        </Field>
        <Field label="Weekly cap (units)">
          <Input
            type="number"
            value={weeklyMaxUnits ?? ""}
            onChange={(e) =>
              setWeeklyMaxUnits(e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Monthly cap (units)">
          <Input
            type="number"
            value={monthlyMaxUnits ?? ""}
            onChange={(e) =>
              setMonthlyMaxUnits(e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
        <Field label="Start date" required>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date" required>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Diagnoses (ICD-10, comma-separated)">
          <Input value={diagnoses} onChange={(e) => setDiagnoses(e.target.value)} />
        </Field>
      </div>

      {isMiHomeHelp && (
        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">
            MI Home Help — task-category minutes (per month)
          </legend>
          <p className="text-xs text-muted-foreground">
            Sum must equal {expectedTaskTotal} (currently {actualTaskTotal}).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MI_TASK_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <span className="w-36">{c}</span>
                <Input
                  type="number"
                  className="flex-1"
                  value={taskMinutes[c] ?? 0}
                  onChange={(e) =>
                    setTaskMinutes((curr) => ({
                      ...curr,
                      [c]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Notes">
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Create authorization"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}
