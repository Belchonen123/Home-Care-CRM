import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";

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
 * delete is reserved for owner-with-reason flows in a separate helper.
 *
 * TODO(prompt-4): also call `logAudit(ctx, { action: `${table}.soft_delete`, ... })`
 *   once the audit-log helper lands. The line below this comment is the exact
 *   hook point — add the call there and wire the actor identity from `ctx.auth`.
 */
export async function softDelete<T extends SoftDeletableTable>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
  args: { byUserId: Id<"users">; reason?: string },
): Promise<void> {
  const row = await ctx.db.get(id);
  if (!row) {
    throw new ConvexError({ code: "NOT_FOUND", message: `${table} not found.` });
  }
  const patch: SoftDeletePatch = {
    deletedAt: Date.now(),
    deletedBy: args.byUserId,
    ...(args.reason ? { deletedReason: args.reason } : {}),
  };
  // Each soft-deletable table has its own document type, but all share the
  // three optional `deleted*` fields declared in the schema. The type system
  // can't narrow `patch` per-T without per-table specialization. The schema
  // is the safety net — adding a table to `SoftDeletableTable` without the
  // matching schema fields would fail at deploy time, not silently.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (ctx.db.patch as any)(id, patch);

  // TODO(prompt-4): audit hook lands here.
  // await logAudit(ctx, {
  //   action: `${table}.soft_delete`,
  //   entityType: table,
  //   entityId: id,
  //   summary: args.reason,
  // });
}
