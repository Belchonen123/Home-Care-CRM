/** YYYY-MM-DD helpers used everywhere expiry dates and auth ranges live. */

export function isoDate(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const yr = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${yr}-${mo}-${day}`;
}

function toUtcMillis(iso: string): number {
  return Date.UTC(
    parseInt(iso.slice(0, 4), 10),
    parseInt(iso.slice(5, 7), 10) - 1,
    parseInt(iso.slice(8, 10), 10),
  );
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMillis(toIso) - toUtcMillis(fromIso)) / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  return isoDate(new Date(toUtcMillis(iso) + days * 86_400_000));
}
