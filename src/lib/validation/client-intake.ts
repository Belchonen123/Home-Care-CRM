import { z } from "zod";
import { PROGRAMS } from "./onboarding";

export const usAddressSchema = z.object({
  line1: z.string().min(1, "Required"),
  line2: z.string().optional(),
  city: z.string().min(1, "Required"),
  state: z.string().length(2, "Two-letter state code"),
  postalCode: z.string().min(5, "Min 5 chars"),
  country: z.literal("US"),
});

export const phoneSchema = z.object({
  kind: z.enum(["home", "mobile", "work", "emergency"]),
  e164: z.string().min(7, "Required"),
  isEvvIvrSource: z.boolean().optional(),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(1, "Required"),
  relationship: z.string().min(1, "Required"),
  phone: z.string().min(7, "Required"),
  email: z.email().optional().or(z.literal("")),
  isPrimary: z.boolean(),
});

const ssnSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^\d{3}-?\d{2}-?\d{4}$/.test(v), {
    message: "SSN must be 9 digits (XXX-XX-XXXX).",
  });

const dobSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "DOB must be YYYY-MM-DD.",
  });

export const clientIntakeSchema = z
  .object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    middleName: z.string().optional(),
    preferredName: z.string().optional(),
    pronouns: z.string().optional(),
    dateOfBirth: dobSchema,
    ssn: ssnSchema,
    medicaidId: z.string().optional(),
    medicareId: z.string().optional(),
    languages: z.array(z.string()).min(1, "Add at least one language"),
    primaryLanguage: z.string().optional(),
    serviceAddress: usAddressSchema,
    mailingSameAsService: z.boolean(),
    mailingAddress: usAddressSchema.optional(),
    phones: z.array(phoneSchema).min(1, "Add at least one phone"),
    email: z.email().optional().or(z.literal("")),
    emergencyContacts: z.array(emergencyContactSchema),
    program: z.enum(PROGRAMS),
    isCdpapConsumer: z.boolean().optional(),
    caseManagerName: z.string().optional(),
    caseManagerEmail: z.email().optional().or(z.literal("")),
    caseManagerPhone: z.string().optional(),
    intakeNotes: z.string().optional(),
    startOfCareDate: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.emergencyContacts.length > 0) {
      const primaries = value.emergencyContacts.filter((c) => c.isPrimary).length;
      if (primaries !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["emergencyContacts"],
          message: "Mark exactly one emergency contact as primary.",
        });
      }
    }
    if (!value.mailingSameAsService && !value.mailingAddress) {
      ctx.addIssue({
        code: "custom",
        path: ["mailingAddress"],
        message: "Provide a mailing address or mark same-as-service.",
      });
    }
  });

export type ClientIntakeValues = z.infer<typeof clientIntakeSchema>;
