import { z } from "zod";

export const STATE_CODES = ["NY", "MI"] as const;
export type StateCode = (typeof STATE_CODES)[number];

export const PROGRAMS = [
  "ny_mltc",
  "ny_cdpap",
  "ny_private_pay",
  "mi_home_help",
  "mi_mi_choice",
  "mi_private_pay",
] as const;
export type ProgramId = (typeof PROGRAMS)[number];

export const PROGRAM_LABELS: Record<ProgramId, string> = {
  ny_mltc: "NY Managed Long Term Care (MLTC)",
  ny_cdpap: "NY Consumer Directed Personal Assistance (CDPAP)",
  ny_private_pay: "NY Private Pay",
  mi_home_help: "MI MDHHS Home Help",
  mi_mi_choice: "MI MI Choice Waiver",
  mi_private_pay: "MI Private Pay",
};

export const PROGRAMS_BY_STATE: Record<StateCode, readonly ProgramId[]> = {
  NY: ["ny_mltc", "ny_cdpap", "ny_private_pay"],
  MI: ["mi_home_help", "mi_mi_choice", "mi_private_pay"],
};

export const usAddressSchema = z.object({
  line1: z.string().min(1, "Required"),
  line2: z.string().optional(),
  city: z.string().min(1, "Required"),
  state: z.string().length(2, "Two-letter state code"),
  postalCode: z.string().min(5, "Min 5 chars"),
  country: z.literal("US"),
});

export const step1BasicsSchema = z.object({
  legalName: z.string().min(2, "Required"),
  taxId: z.string().regex(/^\d{2}-?\d{7}$/, "EIN format: 12-3456789").optional().or(z.literal("")),
  primaryAddress: usAddressSchema,
  timezone: z.string().min(1, "Required"),
});

export const step2StatesSchema = z
  .object({
    states: z.array(z.enum(STATE_CODES)).min(1, "Choose at least one state"),
    programs: z.array(z.enum(PROGRAMS)).min(1, "Choose at least one program"),
  })
  .superRefine((value, ctx) => {
    for (const program of value.programs) {
      const requiredState = (Object.entries(PROGRAMS_BY_STATE) as [StateCode, readonly ProgramId[]][])
        .find(([, list]) => list.includes(program))?.[0];
      if (requiredState && !value.states.includes(requiredState)) {
        ctx.addIssue({
          code: "custom",
          path: ["programs"],
          message: `${PROGRAM_LABELS[program]} requires ${requiredState} to be selected.`,
        });
      }
    }
  });

/** CMS NPI checksum (Luhn over "80840" + first 9 digits). */
export function npiLuhnValid(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = `80840${npi.slice(0, 9)}`;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i] as string, 10);
    if ((digits.length - 1 - i) % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(npi[9] as string, 10);
}

export const step3ProviderIdsSchema = z.object({
  npi: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || npiLuhnValid(v), {
      message: "NPI must be 10 digits and pass the CMS checksum.",
    }),
  champsProviderId: z.string().optional().or(z.literal("")),
  sandataAccountId: z.string().optional().or(z.literal("")),
  hhaxProviderIds: z
    .array(z.object({ mltc: z.string().min(1), id: z.string().min(1) }))
    .optional(),
});

export const contactSchema = z.object({
  name: z.string().min(2, "Required"),
  email: z.email("Invalid email"),
  phone: z.string().optional().or(z.literal("")),
});

export const step4ContactsSchema = z.object({
  billing: contactSchema,
  compliance: contactSchema,
});

export const step5BaaSchema = z.object({
  acknowledged: z.literal(true, { message: "You must acknowledge the BAA to continue." }),
});

export interface OnboardingState {
  step1?: z.infer<typeof step1BasicsSchema>;
  step2?: z.infer<typeof step2StatesSchema>;
  step3?: z.infer<typeof step3ProviderIdsSchema>;
  step4?: z.infer<typeof step4ContactsSchema>;
  step5?: z.infer<typeof step5BaaSchema>;
}
