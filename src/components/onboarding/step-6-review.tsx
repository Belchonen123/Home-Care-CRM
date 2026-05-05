"use client";

import { Button } from "@/components/ui/button";
import { PROGRAM_LABELS } from "@/lib/validation/onboarding";
import type { OnboardingState } from "@/lib/validation/onboarding";

interface Props {
  state: OnboardingState;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

export function Step6Review({ state, onBack, onSubmit, submitting, error }: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">Review</h2>

      <ReviewBlock title="Agency basics">
        <ReviewRow label="Legal name" value={state.step1?.legalName} />
        <ReviewRow label="EIN" value={state.step1?.taxId || "—"} />
        <ReviewRow label="Timezone" value={state.step1?.timezone} />
        <ReviewRow
          label="Address"
          value={
            state.step1
              ? `${state.step1.primaryAddress.line1}, ${state.step1.primaryAddress.city}, ${state.step1.primaryAddress.state} ${state.step1.primaryAddress.postalCode}`
              : undefined
          }
        />
      </ReviewBlock>

      <ReviewBlock title="States & programs">
        <ReviewRow label="States" value={state.step2?.states.join(", ")} />
        <ReviewRow
          label="Programs"
          value={state.step2?.programs.map((p) => PROGRAM_LABELS[p]).join(", ")}
        />
      </ReviewBlock>

      <ReviewBlock title="Provider IDs">
        <ReviewRow label="NPI" value={state.step3?.npi || "—"} />
        <ReviewRow
          label="CHAMPS"
          value={state.step3?.champsProviderId || "—"}
        />
        <ReviewRow
          label="Sandata"
          value={state.step3?.sandataAccountId || "—"}
        />
        <ReviewRow
          label="HHAeXchange"
          value={
            state.step3?.hhaxProviderIds?.length
              ? state.step3.hhaxProviderIds
                  .map((p) => `${p.mltc}: ${p.id}`)
                  .join("; ")
              : "—"
          }
        />
      </ReviewBlock>

      <ReviewBlock title="Contacts">
        <ReviewRow
          label="Billing"
          value={
            state.step4
              ? `${state.step4.billing.name} (${state.step4.billing.email})`
              : undefined
          }
        />
        <ReviewRow
          label="Compliance"
          value={
            state.step4
              ? `${state.step4.compliance.name} (${state.step4.compliance.email})`
              : undefined
          }
        />
      </ReviewBlock>

      <ReviewBlock title="BAA">
        <ReviewRow
          label="Acknowledged"
          value={state.step5?.acknowledged ? "Yes" : "No"}
        />
      </ReviewBlock>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Saving…" : "Finish onboarding"}
        </Button>
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <dl className="mt-2 grid gap-1 text-sm">{children}</dl>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value ?? "—"}</dd>
    </div>
  );
}
