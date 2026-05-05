"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/onboarding/field-label";
import { step1BasicsSchema } from "@/lib/validation/onboarding";

type Values = z.infer<typeof step1BasicsSchema>;

const DEFAULT_TZ = (() => {
  if (typeof Intl === "undefined") return "America/New_York";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
})();

export function Step1Basics({
  initial,
  onNext,
}: {
  initial?: Values;
  onNext: (values: Values) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Values>({
    resolver: zodResolver(step1BasicsSchema),
    mode: "onBlur",
    defaultValues: initial ?? {
      legalName: "",
      taxId: "",
      timezone: DEFAULT_TZ,
      primaryAddress: {
        line1: "",
        line2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
      },
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="legalName" required>
          Legal entity name
        </Label>
        <Input id="legalName" {...register("legalName")} placeholder="Acme Home Care, LLC" />
        {errors.legalName && (
          <p className="text-xs text-destructive">{errors.legalName.message}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="taxId">EIN (optional)</Label>
          <Input id="taxId" placeholder="12-3456789" {...register("taxId")} />
          {errors.taxId && (
            <p className="text-xs text-destructive">{errors.taxId.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone" required>
            Timezone
          </Label>
          <Input id="timezone" {...register("timezone")} />
          {errors.timezone && (
            <p className="text-xs text-destructive">{errors.timezone.message}</p>
          )}
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Primary address</legend>
        <div className="space-y-2">
          <Label htmlFor="line1" required>
            Address line 1
          </Label>
          <Input id="line1" {...register("primaryAddress.line1")} />
          {errors.primaryAddress?.line1 && (
            <p className="text-xs text-destructive">
              {errors.primaryAddress.line1.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="line2">Address line 2</Label>
          <Input id="line2" {...register("primaryAddress.line2")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="city" required>
              City
            </Label>
            <Input id="city" {...register("primaryAddress.city")} />
            {errors.primaryAddress?.city && (
              <p className="text-xs text-destructive">
                {errors.primaryAddress.city.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" required>
              State
            </Label>
            <Input id="state" maxLength={2} {...register("primaryAddress.state")} />
            {errors.primaryAddress?.state && (
              <p className="text-xs text-destructive">
                {errors.primaryAddress.state.message}
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="postalCode" required>
              ZIP
            </Label>
            <Input id="postalCode" {...register("primaryAddress.postalCode")} />
            {errors.primaryAddress?.postalCode && (
              <p className="text-xs text-destructive">
                {errors.primaryAddress.postalCode.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" defaultValue="US" disabled />
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isValid}>
          Continue
        </Button>
      </div>
    </form>
  );
}
