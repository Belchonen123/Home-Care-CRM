import { z } from "zod";

export const usAddressSchema = z.object({
  line1: z.string().min(1, "Required"),
  line2: z.string().optional(),
  city: z.string().min(1, "Required"),
  state: z.string().length(2),
  postalCode: z.string().min(5),
  country: z.literal("US"),
});

export const availabilityWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(24 * 60),
    endMinute: z.number().int().min(0).max(24 * 60),
  })
  .refine((v) => v.startMinute < v.endMinute, {
    message: "End must be after start.",
    path: ["endMinute"],
  });

export const CLASSIFICATIONS = ["hha", "pca", "cna", "dcw", "companion"] as const;

export const caregiverIntakeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  preferredName: z.string().optional(),
  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "DOB must be YYYY-MM-DD.",
    }),
  ssn: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{3}-?\d{2}-?\d{4}$/.test(v), {
      message: "SSN must be 9 digits.",
    }),
  phone: z.string().min(7, "Required"),
  email: z.email().optional().or(z.literal("")),
  languages: z.array(z.string()).min(1, "Add at least one language"),
  address: usAddressSchema.optional(),
  classifications: z.array(z.enum(CLASSIFICATIONS)).min(1, "Choose at least one"),
  employmentType: z.enum(["employee", "contractor"]),
  hireDate: z.string().optional(),
  payRate: z.number().min(0).optional(),
  overtimeMultiplier: z.number().min(1).optional(),
  maxWeeklyHours: z.number().min(0).optional(),
  availability: z.array(availabilityWindowSchema),
  notes: z.string().optional(),
});

export type CaregiverIntakeValues = z.infer<typeof caregiverIntakeSchema>;
