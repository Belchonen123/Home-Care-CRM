import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";
import { logAudit } from "./audit";
import { requireMembership } from "./access";

/**
 * Tables that participate in soft-delete. Must match the schema's set of tables
 * carrying `deletedAt` + `deletedBy`. Adding a new soft-deletable table requires
 * (1) the schema fields and (2) adding it here.
 */
export type SoftDeletableTable = Extract<
  TableNames,
  | "clients"
  | "caregivers"
  | "credentials"
  | "authorizations"
  | "plansOfCare"
  | "visits"
  | "documents"
>;

interface SoftDeletePatch {
  deletedAt: number;
  deletedBy: Id<"users">;
  deletedReason?: string;
}

/**
 * Marks a row as deleted (sets `deletedAt`, `deletedBy`, `deletedReason`). Hard
 * delete is reserved for owner-with-reason flows in a separate helper. Always
 * writes a `<table>.soft_delete` audit entry.
 */
export async function softDelete<T extends SoftDeletableTable>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
  args: { reason?: string },
): Promise<void> {
  const membership = await requireMembership(ctx);
  const row = await ctx.db.get(id);
  if (!row) {
    throw new ConvexError({ code: "NOT_FOUND", message: `${table} not found.` });
  }
  // Cross-tenant guard: refuse to soft-delete a row from another agency, even
  // if the caller produced a valid Id. Some soft-deletable tables don't carry
  // `agencyId` (none today), so we narrow with `in`.
  if ("agencyId" in row && row.agencyId !== membership.agencyId) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Cross-agency access denied." });
  }

  const patch: SoftDeletePatch = {
    deletedAt: Date.now(),
    deletedBy: membership.userId,
    ...(args.reason ? { deletedReason: args.reason } : {}),
  };
  // Each soft-deletable table has its own document type, but all share the
  // three optional `deleted*` fields declared in the schema. The type system
  // can't narrow `patch` per-T without per-table specialization. The schema
  // is the safety net — adding a table to `SoftDeletableTable` without the
  // matching schema fields would fail at deploy time, not silently.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.db.patch as any)(id, patch);

  await logAudit(ctx, membership, {
    action: `${table}.soft_delete`,
    entityType: table,
    entityId: id,
    summary: args.reason,
  });
}
