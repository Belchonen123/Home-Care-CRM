/**
 * Pure: classify a credential or authorization by days-until-expiry.
 *
 * Status rules (from spec §6 Phase 1 #4):
 *   < 0       → "expired"
 *   ≤ 7       → "critical"
 *   ≤ 14      → "warning"
 *   ≤ 30      → "soon"
 *   else      → "ok"
 *   null      → "no_expiry"
 */
export type ExpiryStatus =
  | "no_expiry"
  | "expired"
  | "critical"
  | "warning"
  | "soon"
  | "ok";

export function classifyExpiry(daysUntil: number | null): ExpiryStatus {
  if (daysUntil === null) return "no_expiry";
  if (daysUntil < 0) return "expired";
  if (daysUntil <= 7) return "critical";
  if (daysUntil <= 14) return "warning";
  if (daysUntil <= 30) return "soon";
  return "ok";
}

/** The set of thresholds the credential cron raises alerts at. */
export type AlertThreshold = "30" | "14" | "7";

export function thresholdFor(daysUntil: number): AlertThreshold | "expired" | null {
  if (daysUntil < 0) return "expired";
  if (daysUntil <= 7) return "7";
  if (daysUntil <= 14) return "14";
  if (daysUntil <= 30) return "30";
  return null;
}
