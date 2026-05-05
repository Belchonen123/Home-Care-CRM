"use client";

import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";

type Caregiver = NonNullable<FunctionReturnType<typeof api.caregivers.get>>;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function AvailabilityTab({ caregiver }: { caregiver: Caregiver }) {
  const byDay = new Map<number, Caregiver["availability"]>();
  for (const w of caregiver.availability) {
    const list = byDay.get(w.dayOfWeek) ?? [];
    list.push(w);
    byDay.set(w.dayOfWeek, list);
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">Weekly availability</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Edit on the caregiver record (lands in a follow-up commit). For now,
        showing what was captured at intake.
      </p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-7">
        {DAY_NAMES.map((name, i) => {
          const windows = (byDay.get(i) ?? []).sort(
            (a, b) => a.startMinute - b.startMinute,
          );
          return (
            <li key={name} className="rounded-md border p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {name}
              </div>
              {windows.length === 0 ? (
                <div className="mt-2 text-xs italic text-muted-foreground">—</div>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {windows.map((w, j) => (
                    <li key={j}>
                      {fmt(w.startMinute)}–{fmt(w.endMinute)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
