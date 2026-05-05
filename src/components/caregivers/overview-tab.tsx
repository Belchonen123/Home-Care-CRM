"use client";

import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";

type Caregiver = NonNullable<FunctionReturnType<typeof api.caregivers.get>>;

export function CaregiverOverview({ caregiver }: { caregiver: Caregiver }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Contact</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row k="Phone" v={caregiver.phone} />
          <Row k="Email" v={caregiver.email ?? "—"} />
          <Row
            k="Address"
            v={
              caregiver.address
                ? `${caregiver.address.line1}, ${caregiver.address.city}, ${caregiver.address.state} ${caregiver.address.postalCode}`
                : "—"
            }
          />
          <Row
            k="Languages"
            v={caregiver.languages.length ? caregiver.languages.join(", ") : "—"}
          />
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Employment</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row k="Type" v={caregiver.employmentType} />
          <Row k="Hire date" v={caregiver.hireDate ?? "—"} />
          <Row
            k="Pay rate"
            v={caregiver.payRate !== undefined ? `$${caregiver.payRate.toFixed(2)}/hr` : "—"}
          />
          <Row
            k="OT multiplier"
            v={caregiver.overtimeMultiplier?.toString() ?? "1.5"}
          />
          <Row
            k="Max weekly hrs"
            v={caregiver.maxWeeklyHours?.toString() ?? "—"}
          />
          <Row k="SSN" v={caregiver.ssnPresent ? "On file (masked)" : "—"} />
        </dl>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
}
