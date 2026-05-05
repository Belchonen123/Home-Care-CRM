import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily at 12:00 UTC: scan credentials and raise alerts at the 30/14/7 day
 * thresholds, plus an `expired` alert when the date has passed. Each threshold
 * is deduped via `credentials.alertsSent`.
 */
crons.daily(
  "credential expiry alerts",
  { hourUTC: 12, minuteUTC: 0 },
  internal.alerts.scanCredentialExpiries,
);

/**
 * Daily at 12:15 UTC: scan authorizations for expiry (30/14/7 days) and
 * exhaustion (>= 90% utilized). Both deduped per-(authId, kind).
 */
crons.daily(
  "authorization alerts",
  { hourUTC: 12, minuteUTC: 15 },
  internal.alerts.scanAuthorizationAlerts,
);

/**
 * Daily at 12:30 UTC: transition active authorizations whose endDate has
 * passed to `expired`. Idempotent.
 */
crons.daily(
  "authorization status transitions",
  { hourUTC: 12, minuteUTC: 30 },
  internal.authorizations.markExpired,
);

export default crons;
