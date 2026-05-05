"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  PROGRAM_LABELS,
  PROGRAMS_BY_STATE,
  STATE_CODES,
  step2StatesSchema,
  type ProgramId,
  type StateCode,
} from "@/lib/validation/onboarding";

interface Values {
  states: StateCode[];
  programs: ProgramId[];
}

export function Step2States({
  initial,
  onBack,
  onNext,
}: {
  initial?: Values;
  onBack: () => void;
  onNext: (values: Values) => void;
}) {
  const [states, setStates] = useState<StateCode[]>(initial?.states ?? []);
  const [programs, setPrograms] = useState<ProgramId[]>(initial?.programs ?? []);
  const [error, setError] = useState<string | null>(null);

  const visiblePrograms = useMemo(
    () => states.flatMap((s) => PROGRAMS_BY_STATE[s].map((p) => ({ state: s, program: p }))),
    [states],
  );

  function toggleState(s: StateCode) {
    setStates((curr) =>
      curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s],
    );
    if (states.includes(s)) {
      // Drop programs that belonged exclusively to the removed state.
      setPrograms((curr) =>
        curr.filter((p) => !PROGRAMS_BY_STATE[s].includes(p)),
      );
    }
  }

  function toggleProgram(p: ProgramId) {
    setPrograms((curr) =>
      curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p],
    );
  }

  function submit() {
    const result = step2StatesSchema.safeParse({ states, programs });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input.");
      return;
    }
    onNext(result.data);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">States of operation</h2>
        <p className="text-sm text-muted-foreground">
          Select every state your agency delivers care in.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATE_CODES.map((s) => {
            const active = states.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleState(s)}
                aria-pressed={active}
                className={
                  active
                    ? "rounded-md border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    : "rounded-md border bg-background px-4 py-2 text-sm hover:bg-accent"
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Programs</h2>
        <p className="text-sm text-muted-foreground">
          Programs unlock when their state is selected above.
        </p>
        {visiblePrograms.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Select at least one state to see its programs.
          </p>
        ) : (
          <ul className="space-y-2">
            {visiblePrograms.map(({ program }) => (
              <li key={program}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={programs.includes(program)}
                    onChange={() => toggleProgram(program)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>{PROGRAM_LABELS[program]}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={submit}>
          Continue
        </Button>
      </div>
    </div>
  );
}
