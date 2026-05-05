"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { Trash2, Plus } from "lucide-react";
import { api } from "@convex/_generated/api";
import {
  PROGRAMS,
  PROGRAM_LABELS,
  type ProgramId,
} from "@/lib/validation/onboarding";
import {
  clientIntakeSchema,
  type ClientIntakeValues,
} from "@/lib/validation/client-intake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/onboarding/field-label";

const SECTION_TITLE = "text-base font-semibold";

export function ClientIntakeForm() {
  const router = useRouter();
  const create = useMutation(api.clients.create);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ClientIntakeValues>({
    resolver: zodResolver(clientIntakeSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: "",
      lastName: "",
      languages: ["English"],
      serviceAddress: {
        line1: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
      },
      mailingSameAsService: true,
      phones: [{ kind: "mobile", e164: "" }],
      emergencyContacts: [],
      program: "ny_mltc",
    },
  });
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isValid },
  } = form;

  const phones = useFieldArray({ control, name: "phones" });
  const emergencyContacts = useFieldArray({ control, name: "emergencyContacts" });
  const mailingSame = watch("mailingSameAsService");

  async function onSubmit(values: ClientIntakeValues) {
    setError(null);
    setSubmitting(true);
    try {
      const id = await create({
        firstName: values.firstName,
        lastName: values.lastName,
        middleName: values.middleName || undefined,
        preferredName: values.preferredName || undefined,
        pronouns: values.pronouns || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        ssn: values.ssn ? values.ssn.replace(/\D/g, "") : undefined,
        medicaidId: values.medicaidId || undefined,
        medicareId: values.medicareId || undefined,
        languages: values.languages,
        primaryLanguage: values.primaryLanguage || undefined,
        serviceAddress: values.serviceAddress,
        mailingAddress: values.mailingSameAsService ? undefined : values.mailingAddress,
        phones: values.phones,
        email: values.email || undefined,
        emergencyContacts: values.emergencyContacts,
        program: values.program,
        isCdpapConsumer: values.isCdpapConsumer,
        caseManagerName: values.caseManagerName || undefined,
        caseManagerEmail: values.caseManagerEmail || undefined,
        caseManagerPhone: values.caseManagerPhone || undefined,
        intakeNotes: values.intakeNotes || undefined,
        startOfCareDate: values.startOfCareDate || undefined,
      });
      router.replace(`/app/clients/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create client.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card className="space-y-4 p-5">
        <h2 className={SECTION_TITLE}>Identity</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName?.message}>
            <Input {...register("firstName")} />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <Input {...register("lastName")} />
          </Field>
          <Field label="Middle name">
            <Input {...register("middleName")} />
          </Field>
          <Field label="Preferred name">
            <Input {...register("preferredName")} />
          </Field>
          <Field label="Date of birth (YYYY-MM-DD)" error={errors.dateOfBirth?.message}>
            <Input placeholder="1948-07-19" {...register("dateOfBirth")} />
          </Field>
          <Field label="SSN" error={errors.ssn?.message}>
            <Input
              placeholder="XXX-XX-XXXX"
              autoComplete="off"
              inputMode="numeric"
              {...register("ssn")}
            />
          </Field>
          <Field label="Medicaid ID">
            <Input {...register("medicaidId")} />
          </Field>
          <Field label="Medicare ID">
            <Input {...register("medicareId")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className={SECTION_TITLE}>Program</h2>
        <Field label="Program" required error={errors.program?.message}>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register("program")}
          >
            {PROGRAMS.map((p) => (
              <option key={p} value={p}>
                {PROGRAM_LABELS[p as ProgramId]}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            {...register("isCdpapConsumer")}
          />
          This client is the consumer in a NY CDPAP arrangement.
        </label>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className={SECTION_TITLE}>Service address</h2>
        <Field label="Line 1" required error={errors.serviceAddress?.line1?.message}>
          <Input {...register("serviceAddress.line1")} />
        </Field>
        <Field label="Line 2">
          <Input {...register("serviceAddress.line2")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="City"
            required
            error={errors.serviceAddress?.city?.message}
            className="sm:col-span-2"
          >
            <Input {...register("serviceAddress.city")} />
          </Field>
          <Field label="State" required error={errors.serviceAddress?.state?.message}>
            <Input maxLength={2} {...register("serviceAddress.state")} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="ZIP"
            required
            error={errors.serviceAddress?.postalCode?.message}
          >
            <Input {...register("serviceAddress.postalCode")} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            {...register("mailingSameAsService")}
            defaultChecked
          />
          Mailing address same as service address.
        </label>

        {!mailingSame && (
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Mailing address</legend>
            <Field label="Line 1" required error={errors.mailingAddress?.line1?.message}>
              <Input {...register("mailingAddress.line1")} />
            </Field>
            <Field label="Line 2">
              <Input {...register("mailingAddress.line2")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="City"
                required
                error={errors.mailingAddress?.city?.message}
                className="sm:col-span-2"
              >
                <Input {...register("mailingAddress.city")} />
              </Field>
              <Field
                label="State"
                required
                error={errors.mailingAddress?.state?.message}
              >
                <Input maxLength={2} {...register("mailingAddress.state")} />
              </Field>
            </div>
            <Field
              label="ZIP"
              required
              error={errors.mailingAddress?.postalCode?.message}
            >
              <Input {...register("mailingAddress.postalCode")} />
            </Field>
            <input type="hidden" value="US" {...register("mailingAddress.country")} />
          </fieldset>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className={SECTION_TITLE}>Contact</h2>
        <div className="space-y-2">
          <Label>Phones</Label>
          <p className="text-xs text-muted-foreground">
            Mark a home phone as &quot;EVV IVR source&quot; if you want IVR clock-ins
            from that line to identify this client automatically.
          </p>
          {phones.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 sm:grid-cols-[160px_1fr_160px_auto]">
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register(`phones.${i}.kind` as const)}
              >
                <option value="home">Home</option>
                <option value="mobile">Mobile</option>
                <option value="work">Work</option>
                <option value="emergency">Emergency</option>
              </select>
              <Input
                placeholder="+1 555 555 5555"
                {...register(`phones.${i}.e164` as const)}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  {...register(`phones.${i}.isEvvIvrSource` as const)}
                />
                EVV IVR source
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => phones.remove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {errors.phones && (
            <p className="text-xs text-destructive">{errors.phones.message}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => phones.append({ kind: "mobile", e164: "" })}
          >
            <Plus className="h-4 w-4" /> Add phone
          </Button>
        </div>

        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} />
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className={SECTION_TITLE}>Emergency contacts</h2>
        {emergencyContacts.fields.length === 0 && (
          <p className="text-sm italic text-muted-foreground">None yet.</p>
        )}
        {emergencyContacts.fields.map((f, i) => (
          <div key={f.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            <Input
              placeholder="Name"
              {...register(`emergencyContacts.${i}.name` as const)}
            />
            <Input
              placeholder="Relationship"
              {...register(`emergencyContacts.${i}.relationship` as const)}
            />
            <Input
              placeholder="Phone"
              {...register(`emergencyContacts.${i}.phone` as const)}
            />
            <Input
              placeholder="Email (optional)"
              {...register(`emergencyContacts.${i}.email` as const)}
            />
            <label className="col-span-full flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                {...register(`emergencyContacts.${i}.isPrimary` as const)}
              />
              Primary contact
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="col-span-full justify-self-end"
              onClick={() => emergencyContacts.remove(i)}
            >
              Remove
            </Button>
          </div>
        ))}
        {errors.emergencyContacts && (
          <p className="text-xs text-destructive">
            {(errors.emergencyContacts as { message?: string }).message ?? ""}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            emergencyContacts.append({
              name: "",
              relationship: "",
              phone: "",
              email: "",
              isPrimary: emergencyContacts.fields.length === 0,
            })
          }
        >
          <Plus className="h-4 w-4" /> Add contact
        </Button>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className={SECTION_TITLE}>Case manager</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input {...register("caseManagerName")} />
          </Field>
          <Field label="Email" error={errors.caseManagerEmail?.message}>
            <Input type="email" {...register("caseManagerEmail")} />
          </Field>
          <Field label="Phone">
            <Input {...register("caseManagerPhone")} />
          </Field>
        </div>
        <Field label="Intake notes">
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register("intakeNotes")}
          />
        </Field>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting ? "Saving…" : "Create client"}
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, required, error, className, children }: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
