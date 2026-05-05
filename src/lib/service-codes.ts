import type { ProgramId } from "@/lib/validation/onboarding";

export interface ServiceCode {
  code: string;
  label: string;
  /** Default unit length in minutes for this service code. */
  defaultUnitMinutes: number;
  /** Programs this code is commonly used with. */
  programs: ProgramId[];
}

/**
 * Common home-care service codes. Not exhaustive — UI lets the user enter a
 * custom code. Defaults are typical (e.g. PCA T1019 = 15-min units).
 */
export const SERVICE_CODES: ServiceCode[] = [
  {
    code: "T1019",
    label: "Personal Care Aide (15-min units)",
    defaultUnitMinutes: 15,
    programs: ["ny_mltc", "ny_cdpap", "ny_private_pay", "mi_home_help"],
  },
  {
    code: "T1020",
    label: "Personal Care Aide (per diem)",
    defaultUnitMinutes: 1440,
    programs: ["ny_mltc"],
  },
  {
    code: "S5125",
    label: "Companion / Attendant care (15-min units)",
    defaultUnitMinutes: 15,
    programs: ["ny_mltc", "ny_private_pay", "mi_home_help", "mi_private_pay"],
  },
  {
    code: "S5130",
    label: "Homemaker services (15-min units)",
    defaultUnitMinutes: 15,
    programs: ["mi_home_help", "mi_mi_choice"],
  },
  {
    code: "S9122",
    label: "Home health aide / certified assistance (per visit)",
    defaultUnitMinutes: 60,
    programs: ["ny_mltc"],
  },
  {
    code: "T2025",
    label: "MI Home Help (monthly)",
    defaultUnitMinutes: 1,
    programs: ["mi_home_help"],
  },
];

/**
 * MDHHS-6064-P task categories for MI Home Help authorizations. Sum of
 * minutes across categories must equal the authorized monthly minutes
 * (validated server-side).
 */
export const MI_TASK_CATEGORIES = [
  "Eating",
  "Toileting",
  "Bathing",
  "Grooming",
  "Dressing",
  "Transferring",
  "Mobility",
  "Medication",
  "Meal preparation",
  "Shopping",
  "Laundry",
  "Housework",
] as const;
