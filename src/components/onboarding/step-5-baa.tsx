"use client";

import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { z } from "zod";
import { step5BaaSchema } from "@/lib/validation/onboarding";

type Values = z.infer<typeof step5BaaSchema>;

export function Step5Baa({
  initial,
  onBack,
  onNext,
}: {
  initial?: Values;
  onBack: () => void;
  onNext: (values: Values) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(initial?.acknowledged ?? false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const result = step5BaaSchema.safeParse({ acknowledged });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input.");
      return;
    }
    onNext(result.data);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Business Associate Agreement
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          By continuing, you acknowledge the BAA between your agency and Home Care
          CRM. We&apos;ll record this acknowledgment with a timestamp and your IP
          address in the audit log. The signed BAA is required before any PHI is
          stored.
        </p>
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/legal/baa-template.pdf" download>
              <Download className="h-4 w-4" /> Download BAA template
            </a>
          </Button>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border p-4 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => {
            setAcknowledged(e.target.checked);
            setError(null);
          }}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        />
        <span>
          I confirm I have authority to bind the agency, I have read the BAA, and I
          agree to its terms.
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={submit} disabled={!acknowledged}>
          Continue
        </Button>
      </div>
    </div>
  );
}
