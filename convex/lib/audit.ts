import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { AppRole, Membership } from "./access";

export interface AuditEntry {
  /** Dot-namespaced action: "client.create", "phi.read.ssn", "evv.exception.resolve". */
  action: string;
  entityType?: string;
  entityId?: string;
  /** Human-readable summary. NEVER include PHI plaintext. */
  summary?: string;
  /** Names of fields that were written to (no values). */
  fieldChanges?: string[];
  ip?: string;
  userAgent?: string;
}

/**
 * Append-only audit log. Every PHI-touching mutation must call this; PHI reads of
 * decrypted fields call this with `action: "phi.read.<field>"`.
 *
 * `auditLog` rows are append-only. Convex doesn't enforce that at the DB level,
 * so we enforce it by convention: only this helper writes to that table, and the
 * code review checklist flags any direct `ctx.db.insert("auditLog", ...)` outside
 * here.
 */
export async function logAudit(
  ctx: MutationCtx,
  membership: Membership,
  entry: AuditEntry,
): Promise<Id<"auditLog">> {
  return ctx.db.insert("auditLog", {
    agencyId: membership.agencyId,
    actorUserId: membership.userId,
    actorClerkUserId: membership.identity.clerkUserId,
    actorRole: membership.role as AppRole,
    action: entry.action,
    targetTable: entry.entityType,
    targetId: entry.entityId,
    summary: entry.summary,
    fieldChanges: entry.fieldChanges,
    ip: entry.ip,
    userAgent: entry.userAgent,
    at: Date.now(),
  });
}

/**
 * Names of fields that changed between `before` and `after`. Use to populate
 * `fieldChanges` on an audit entry without leaking values.
 */
export function diffFieldNames<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: Partial<T>,
): string[] {
  if (!before) return Object.keys(after);
  const changed: string[] = [];
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(String(key));
    }
  }
  return changed;
}
