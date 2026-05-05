"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  CLASSIFICATIONS,
  caregiverIntakeSchema,
  type CaregiverIntakeValues,
} from "@/lib/validation/caregiver-intake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/onboarding/field-label";

export function CaregiverIntakeForm() {
  const router = useRouter();
  const create = useMutation(api.caregivers.create);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CaregiverIntakeValues>({
    resolver: zodResolver(caregiverIntakeSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      languages: ["English"],
      classifications: ["hha"],
      employmentType: "employee",
      availability: [],
    },
  });

  async function onSubmit(values: CaregiverIntakeValues) {
    setError(null);
    setSubmitting(true);
    try {
      const id = await create({
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        ssn: values.ssn ? values.ssn.replace(/\D/g, "") : undefined,
        phone: values.phone,
        email: values.email || undefined,
        languages: values.languages,
        address: values.address,
        classifications: values.classifications,
        employmentType: values.employmentType,
        hireDate: values.hireDate || undefined,
        payRate: values.payRate,
        overtimeMultiplier: values.overtimeMultiplier,
        maxWeeklyHours: values.maxWeeklyHours,
        availability: values.availability,
        notes: values.notes || undefined,
      });
      router.replace(`/app/caregivers/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create caregiver.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card className="space-y-4 p-5">
        <h2 className="text-base font-semibold">Identity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName?.message}>
            <Input {...register("firstName")} />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <Input {...register("lastName")} />
          </Field>
          <Field label="Preferred name">
            <Input {...register("preferredName")} />
          </Field>
          <Field label="DOB (YYYY-MM-DD)" error={errors.dateOfBirth?.message}>
            <Input {...register("dateOfBirth")} />
          </Field>
          <Field label="SSN" error={errors.ssn?.message}>
            <Input
              autoComplete="off"
              inputMode="numeric"
              placeholder="XXX-XX-XXXX"
              {...register("ssn")}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-base font-semibold">Contact</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" required error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-base font-semibold">Employment</h2>
        <Field label="Classifications" required error={errors.classifications?.message}>
          <div className="flex flex-wrap gap-2">
            {CLASSIFICATIONS.map((c) => (
              <label
                key={c}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  value={c}
                  className="h-4 w-4 rounded border-border accent-primary"
                  {...register("classifications")}
                />
                <span className="uppercase">{c}</span>
              </label>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Employment type" required>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register("employmentType")}
            >
              <option value="employee">Employee</option>
              <option value="contractor">Contractor</option>
            </select>
          </Field>
          <Field label="Hire date">
            <Input type="date" {...register("hireDate")} />
          </Field>
          <Field label="Pay rate ($/hr)">
            <Input type="number" step="0.01" {...register("payRate", { valueAsNumber: true })} />
          </Field>
          <Field label="Overtime multiplier">
            <Input type="number" step="0.1" defaultValue={1.5} {...register("overtimeMultiplier", { valueAsNumber: true })} />
          </Field>
          <Field label="Max weekly hours">
            <Input type="number" {...register("maxWeeklyHours", { valueAsNumber: true })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-base font-semibold">Notes</h2>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("notes")}
        />
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting ? "Saving…" : "Create caregiver"}
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}
function Field({ label, required, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
