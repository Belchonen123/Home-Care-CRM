"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/onboarding/field-label";
import { step4ContactsSchema } from "@/lib/validation/onboarding";

type Values = z.infer<typeof step4ContactsSchema>;

export function Step4Contacts({
  initial,
  onBack,
  onNext,
}: {
  initial?: Values;
  onBack: () => void;
  onNext: (values: Values) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Values>({
    resolver: zodResolver(step4ContactsSchema),
    mode: "onBlur",
    defaultValues: initial ?? {
      billing: { name: "", email: "", phone: "" },
      compliance: { name: "", email: "", phone: "" },
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <ContactBlock
        title="Billing contact"
        prefix="billing"
        register={register}
        errors={errors.billing}
      />
      <ContactBlock
        title="Compliance contact"
        prefix="compliance"
        register={register}
        errors={errors.compliance}
      />

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

interface ContactBlockProps {
  title: string;
  prefix: "billing" | "compliance";
  register: ReturnType<typeof useForm<Values>>["register"];
  errors?: {
    name?: { message?: string };
    email?: { message?: string };
    phone?: { message?: string };
  };
}

function ContactBlock({ title, prefix, register, errors }: ContactBlockProps) {
  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-name`} required>
          Name
        </Label>
        <Input id={`${prefix}-name`} {...register(`${prefix}.name`)} />
        {errors?.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-email`} required>
            Email
          </Label>
          <Input id={`${prefix}-email`} type="email" {...register(`${prefix}.email`)} />
          {errors?.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-phone`}>Phone</Label>
          <Input id={`${prefix}-phone`} type="tel" {...register(`${prefix}.phone`)} />
        </div>
      </div>
    </fieldset>
  );
}
