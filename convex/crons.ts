import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily at 12:00 UTC: scan credentials and raise alerts at the 30/14/7 day
 * thresholds, plus an `expired` alert when the date has passed. Each threshold
 * is deduped via `credentials.alertsSent`. v1 runs in a single UTC window;
 * per-agency local-time scheduling lands in a Phase 7 polish pass.
 */
crons.daily(
  "credential expiry alerts",
  { hourUTC: 12, minuteUTC: 0 },
  internal.alerts.scanCredentialExpiries,
);

export default crons;
