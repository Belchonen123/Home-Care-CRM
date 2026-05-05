"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Stepper } from "./stepper";
import { Step1Basics } from "./step-1-basics";
import { Step2States } from "./step-2-states";
import { Step3ProviderIds } from "./step-3-provider-ids";
import { Step4Contacts } from "./step-4-contacts";
import { Step5Baa } from "./step-5-baa";
import { Step6Review } from "./step-6-review";
import type { OnboardingState } from "@/lib/validation/onboarding";

const STEPS = [
  { id: 1, label: "Agency basics" },
  { id: 2, label: "States & programs" },
  { id: 3, label: "Provider IDs" },
  { id: 4, label: "Contacts" },
  { id: 5, label: "BAA" },
  { id: 6, label: "Review" },
] as const;

export function OnboardingWizard({ agencyName }: { agencyName: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const stepParam = parseInt(params.get("step") ?? "1", 10);
  const step = STEPS.find((s) => s.id === stepParam)?.id ?? 1;

  const [state, setState] = useState<OnboardingState>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completeOnboarding = useMutation(api.agencies.completeOnboarding);

  const goTo = useCallback(
    (nextStep: number) => {
      const next = new URLSearchParams(params);
      next.set("step", String(nextStep));
      router.replace(`/onboarding?${next.toString()}`);
    },
    [router, params],
  );

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (!state.step1 || !state.step2 || !state.step3 || !state.step4 || !state.step5) {
        throw new Error("Some steps are incomplete.");
      }
      await completeOnboarding({
        legalName: state.step1.legalName,
        states: state.step2.states,
        programs: state.step2.programs,
        npi: state.step3.npi || undefined,
        taxId: state.step1.taxId?.replace(/\D/g, "")
          ? `${state.step1.taxId.replace(/\D/g, "").slice(0, 2)}-${state.step1.taxId.replace(/\D/g, "").slice(2)}`
          : undefined,
        addresses: [
          { ...state.step1.primaryAddress, country: "US" as const },
        ],
        billingContact: state.step4.billing,
        providerIds: {
          champsProviderId: state.step3.champsProviderId || undefined,
          sandataAccountId: state.step3.sandataAccountId || undefined,
          hhaxProviderIds: state.step3.hhaxProviderIds?.length
            ? state.step3.hhaxProviderIds
            : undefined,
        },
        timezone: state.step1.timezone,
        baaAcknowledged: true,
        markComplete: true,
      });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete onboarding.");
      setSubmitting(false);
    }
  }, [state, completeOnboarding, router]);

  const heading = useMemo(() => `Set up ${agencyName}`, [agencyName]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-8 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Onboarding
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          A few minutes; your answers can be edited later in Settings.
        </p>
      </header>

      <Stepper steps={STEPS} current={step} />

      <Card className="mt-6 p-6">
        {step === 1 && (
          <Step1Basics
            initial={state.step1}
            onNext={(values) => {
              setState((s) => ({ ...s, step1: values }));
              goTo(2);
            }}
          />
        )}
        {step === 2 && (
          <Step2States
            initial={state.step2}
            onBack={() => goTo(1)}
            onNext={(values) => {
              setState((s) => ({ ...s, step2: values }));
              goTo(3);
            }}
          />
        )}
        {step === 3 && (
          <Step3ProviderIds
            initial={state.step3}
            states={state.step2?.states ?? []}
            onBack={() => goTo(2)}
            onNext={(values) => {
              setState((s) => ({ ...s, step3: values }));
              goTo(4);
            }}
          />
        )}
        {step === 4 && (
          <Step4Contacts
            initial={state.step4}
            onBack={() => goTo(3)}
            onNext={(values) => {
              setState((s) => ({ ...s, step4: values }));
              goTo(5);
            }}
          />
        )}
        {step === 5 && (
          <Step5Baa
            initial={state.step5}
            onBack={() => goTo(4)}
            onNext={(values) => {
              setState((s) => ({ ...s, step5: values }));
              goTo(6);
            }}
          />
        )}
        {step === 6 && (
          <Step6Review
            state={state}
            onBack={() => goTo(5)}
            submitting={submitting}
            error={error}
            onSubmit={onSubmit}
          />
        )}
      </Card>

      <p className={cn("mt-4 text-center text-xs text-muted-foreground")}>
        Need help? Email{" "}
        <a href="mailto:support@example.com" className="underline">
          support@example.com
        </a>
        .
      </p>
    </main>
  );
}
