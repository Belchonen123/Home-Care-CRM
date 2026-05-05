"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/onboarding/field-label";
import {
  step3ProviderIdsSchema,
  type StateCode,
} from "@/lib/validation/onboarding";

type Values = z.infer<typeof step3ProviderIdsSchema>;

export function Step3ProviderIds({
  initial,
  states,
  onBack,
  onNext,
}: {
  initial?: Values;
  states: StateCode[];
  onBack: () => void;
  onNext: (values: Values) => void;
}) {
  const showMI = states.includes("MI");
  const showNY = states.includes("NY");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Values>({
    resolver: zodResolver(step3ProviderIdsSchema),
    mode: "onBlur",
    defaultValues: initial ?? {
      npi: "",
      champsProviderId: "",
      sandataAccountId: "",
      hhaxProviderIds: [],
    },
  });
  const hhax = useFieldArray<Values>({ control, name: "hhaxProviderIds" });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="npi">NPI</Label>
        <Input id="npi" placeholder="10 digits" maxLength={10} {...register("npi")} />
        {errors.npi && <p className="text-xs text-destructive">{errors.npi.message}</p>}
      </div>

      {showMI && (
        <div className="space-y-2">
          <Label htmlFor="champsProviderId">CHAMPS provider ID (MI)</Label>
          <Input id="champsProviderId" {...register("champsProviderId")} />
        </div>
      )}

      {(showNY || showMI) && (
        <div className="space-y-2">
          <Label htmlFor="sandataAccountId">Sandata account ID</Label>
          <Input id="sandataAccountId" {...register("sandataAccountId")} />
        </div>
      )}

      {showNY && (
        <fieldset className="space-y-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">HHAeXchange provider IDs</legend>
          <p className="text-xs text-muted-foreground">
            Add one row per MLTC plan you bill against.
          </p>
          {hhax.fields.length === 0 && (
            <p className="text-sm italic text-muted-foreground">No entries yet.</p>
          )}
          {hhax.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="MLTC name"
                {...register(`hhaxProviderIds.${i}.mltc` as const)}
              />
              <Input
                placeholder="Provider ID"
                {...register(`hhaxProviderIds.${i}.id` as const)}
              />
              <Button type="button" variant="outline" onClick={() => hhax.remove(i)}>
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => hhax.append({ mltc: "", id: "" })}
          >
            Add MLTC
          </Button>
        </fieldset>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={!isValid}>
          Continue
        </Button>
      </div>
    </form>
  );
}
