import { ConvexError, v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  hasPermission,
  requirePermission,
  type Membership,
} from "./lib/access";
import { logAudit, diffFieldNames } from "./lib/audit";
import { encryptField, decryptField, lastFourSsn } from "./lib/crypto";
import { softDelete } from "./lib/softDelete";
import type { Doc, Id } from "./_generated/dataModel";

const usAddress = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
  country: v.literal("US"),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  geocodedAt: v.optional(v.number()),
});

const phoneEntry = v.object({
  kind: v.union(
    v.literal("home"),
    v.literal("mobile"),
    v.literal("work"),
    v.literal("emergency"),
  ),
  e164: v.string(),
  isEvvIvrSource: v.optional(v.boolean()),
});

const emergencyContact = v.object({
  name: v.string(),
  relationship: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  isPrimary: v.boolean(),
});

const program = v.union(
  v.literal("ny_mltc"),
  v.literal("ny_cdpap"),
  v.literal("ny_private_pay"),
  v.literal("mi_home_help"),
  v.literal("mi_mi_choice"),
  v.literal("mi_private_pay"),
);

const status = v.union(
  v.literal("intake"),
  v.literal("active"),
  v.literal("on_hold"),
  v.literal("discharged"),
);

/* --------------------------------- queries -------------------------------- */

export const list = query({
  args: {
    statusFilter: v.optional(status),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "client.read");
    const cap = Math.min(args.limit ?? 100, 500);

    const cursor = args.statusFilter
      ? ctx.db
          .query("clients")
          .withIndex("by_agency_status", (q) =>
            q.eq("agencyId", m.agencyId).eq("status", args.statusFilter as Doc<"clients">["status"]),
          )
      : ctx.db
          .query("clients")
          .withIndex("by_agency_lastname", (q) => q.eq("agencyId", m.agencyId));

    const rows = await cursor
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .take(cap);

    const term = args.search?.trim().toLowerCase();
    const filtered = term
      ? rows.filter(
          (r) =>
            r.firstName.toLowerCase().includes(term) ||
            r.lastName.toLowerCase().includes(term) ||
            (r.medicaidId && r.medicaidId.toLowerCase().includes(term)),
        )
      : rows;

    return filtered.map((c) => ({
      _id: c._id,
      firstName: c.firstName,
      lastName: c.lastName,
      preferredName: c.preferredName,
      status: c.status,
      program: c.program,
      city: c.serviceAddress.city,
      stateCode: c.serviceAddress.state,
      languages: c.languages,
      startOfCareDate: c.startOfCareDate,
      isCdpapConsumer: c.isCdpapConsumer,
    }));
  },
});

export const get = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "client.read");
    const client = await ctx.db.get(args.clientId);
    if (!client || client.agencyId !== m.agencyId || client.deletedAt) return null;

    const auths = await ctx.db
      .query("authorizations")
      .withIndex("by_agency_client", (q) =>
        q.eq("agencyId", m.agencyId).eq("clientId", client._id),
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
    const activeAuths = auths.filter((a) => a.status === "active").length;

    const lastVisit = await ctx.db
      .query("visits")
      .withIndex("by_agency_client_scheduled", (q) =>
        q.eq("agencyId", m.agencyId).eq("clientId", client._id),
      )
      .order("desc")
      .first();

    const canSeeSsn = hasPermission(m.role, "phi.ssn.read");

    return {
      ...client,
      ssnEncrypted: undefined,
      ssnPresent: !!client.ssnEncrypted,
      // Caregivers see only month-day; everyone else with phi.dob.read sees full DOB later
      // via a separate revealDob() mutation that audit-logs the read.
      dobMonthDay: client.dobMonthDay,
      activeAuthorizationCount: activeAuths,
      authorizationCount: auths.length,
      lastVisitAt: lastVisit?.scheduledStart ?? null,
      _canSeeSsn: canSeeSsn,
    };
  },
});

/**
 * Reveals the full SSN (decrypted) to a privileged caller and writes a
 * `phi.read.ssn` audit entry. Returns last-four masking if the role lacks the
 * permission, so the UI can still show "***-**-1234".
 */
export const revealSsn = mutation({
  args: { clientId: v.id("clients"), reveal: v.boolean() },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "client.read");
    const client = await ctx.db.get(args.clientId);
    if (!client || client.agencyId !== m.agencyId || client.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    if (!client.ssnEncrypted) return null;

    if (!args.reveal || !hasPermission(m.role, "phi.ssn.read")) {
      // Return a masked value without decrypting.
      return { masked: "***-**-****", revealed: false } as const;
    }

    const plain = await decryptField(client.ssnEncrypted);
    await logAudit(ctx, m, {
      action: "phi.read.ssn",
      entityType: "clients",
      entityId: client._id,
      summary: "Decrypted SSN for billing/compliance review",
    });
    return {
      masked: lastFourSsn(plain),
      full: plain,
      revealed: true,
    } as const;
  },
});

/* -------------------------------- mutations ------------------------------- */

const createInput = v.object({
  firstName: v.string(),
  lastName: v.string(),
  middleName: v.optional(v.string()),
  preferredName: v.optional(v.string()),
  pronouns: v.optional(v.string()),
  dateOfBirth: v.optional(v.string()), // YYYY-MM-DD plaintext from form
  ssn: v.optional(v.string()), // plaintext from form; encrypted before insert
  medicaidId: v.optional(v.string()),
  medicareId: v.optional(v.string()),
  languages: v.array(v.string()),
  primaryLanguage: v.optional(v.string()),
  serviceAddress: usAddress,
  mailingAddress: v.optional(usAddress),
  phones: v.array(phoneEntry),
  email: v.optional(v.string()),
  emergencyContacts: v.array(emergencyContact),
  program,
  isCdpapConsumer: v.optional(v.boolean()),
  payerId: v.optional(v.id("payers")),
  caseManagerName: v.optional(v.string()),
  caseManagerEmail: v.optional(v.string()),
  caseManagerPhone: v.optional(v.string()),
  intakeNotes: v.optional(v.string()),
  startOfCareDate: v.optional(v.string()),
});

export const create = mutation({
  args: createInput,
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "client.write");
    return createClientImpl(ctx, m, args);
  },
});

export const update = mutation({
  args: {
    clientId: v.id("clients"),
    patch: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      preferredName: v.optional(v.string()),
      languages: v.optional(v.array(v.string())),
      primaryLanguage: v.optional(v.string()),
      serviceAddress: v.optional(usAddress),
      mailingAddress: v.optional(usAddress),
      phones: v.optional(v.array(phoneEntry)),
      email: v.optional(v.string()),
      emergencyContacts: v.optional(v.array(emergencyContact)),
      caseManagerName: v.optional(v.string()),
      caseManagerEmail: v.optional(v.string()),
      caseManagerPhone: v.optional(v.string()),
      intakeNotes: v.optional(v.string()),
      startOfCareDate: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "client.write");
    const before = await ctx.db.get(args.clientId);
    if (!before || before.agencyId !== m.agencyId || before.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    const patch = { ...args.patch, updatedAt: Date.now() };
    await ctx.db.patch(args.clientId, patch);
    await logAudit(ctx, m, {
      action: "client.update",
      entityType: "clients",
      entityId: args.clientId,
      summary: "Updated client record",
      fieldChanges: diffFieldNames(before, patch),
    });
    return args.clientId;
  },
});

export const setStatus = mutation({
  args: {
    clientId: v.id("clients"),
    status,
    reason: v.optional(v.string()),
    dischargeDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "client.write");
    const client = await ctx.db.get(args.clientId);
    if (!client || client.agencyId !== m.agencyId || client.deletedAt) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    if (args.status === "discharged" && !args.dischargeDate) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Discharge date is required when status is discharged.",
      });
    }
    await ctx.db.patch(args.clientId, {
      status: args.status,
      statusReason: args.reason,
      dischargeDate: args.dischargeDate ?? client.dischargeDate,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, m, {
      action: "client.set_status",
      entityType: "clients",
      entityId: args.clientId,
      summary: `Status -> ${args.status}`,
      fieldChanges: ["status", "statusReason", "dischargeDate"],
    });
  },
});

export const remove = mutation({
  args: { clientId: v.id("clients"), reason: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "client.delete");
    await softDelete(ctx, "clients", args.clientId, { reason: args.reason });
  },
});

/* ---------------------- internal: insert + geocoding --------------------- */

/**
 * Server-side address geocoder. Calls Mapbox if `MAPBOX_TOKEN` is configured;
 * otherwise returns the input unchanged. Cached in the `geocodeCache` table
 * keyed on a normalized address hash so we don't re-bill Mapbox for repeats.
 */
export const geocodeAndCreate = internalAction({
  args: createInput,
  handler: async (ctx, args): Promise<Id<"clients">> => {
    const serviceAddress = await maybeGeocode(ctx, args.serviceAddress);
    const mailingAddress = args.mailingAddress
      ? await maybeGeocode(ctx, args.mailingAddress)
      : undefined;
    return ctx.runMutation(internal.clients._insert, {
      ...args,
      serviceAddress,
      mailingAddress,
    });
  },
});

async function maybeGeocode(
  ctx: ActionCtx,
  addr: typeof createInput.fields.serviceAddress.type extends infer A ? A : never,
): Promise<typeof addr> {
  // Light fence: only fan out to Mapbox when a token is present and the address
  // doesn't already carry coordinates.
  if (addr.lat !== undefined && addr.lng !== undefined) return addr;
  const token = process.env.MAPBOX_TOKEN;
  if (!token) return addr;

  const hash = addressHash(addr);
  const cached = (await ctx.runQuery(internal.clients._lookupGeocode, { hash })) as
    | { lat: number; lng: number }
    | null;
  if (cached) {
    return { ...addr, lat: cached.lat, lng: cached.lng, geocodedAt: Date.now() };
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    `${addr.line1}, ${addr.city}, ${addr.state} ${addr.postalCode}`,
  )}.json?access_token=${token}&country=us&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return addr;
    const json = (await res.json()) as { features?: { center?: [number, number] }[] };
    const center = json.features?.[0]?.center;
    if (!center) return addr;
    const [lng, lat] = center;
    await ctx.runMutation(internal.clients._cacheGeocode, { hash, lat, lng });
    return { ...addr, lat, lng, geocodedAt: Date.now() };
  } catch {
    return addr;
  }
}

function addressHash(addr: { line1: string; city: string; state: string; postalCode: string }): string {
  return [addr.line1, addr.city, addr.state, addr.postalCode]
    .map((s) => s.trim().toLowerCase())
    .join("|");
}

export const _lookupGeocode = query({
  args: { hash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("geocodeCache")
      .withIndex("by_address_hash", (q) => q.eq("addressHash", args.hash))
      .unique();
    return row ? { lat: row.lat, lng: row.lng } : null;
  },
});

export const _cacheGeocode = internalMutation({
  args: { hash: v.string(), lat: v.number(), lng: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("geocodeCache")
      .withIndex("by_address_hash", (q) => q.eq("addressHash", args.hash))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lat: args.lat,
        lng: args.lng,
        cachedAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("geocodeCache", {
      addressHash: args.hash,
      lat: args.lat,
      lng: args.lng,
      provider: "mapbox",
      cachedAt: Date.now(),
    });
  },
});

export const _insert = internalMutation({
  args: createInput,
  handler: async (ctx, args) => {
    const m = await requirePermission(ctx, "client.write");
    return createClientImpl(ctx, m, args);
  },
});

async function createClientImpl(
  ctx: MutationCtx,
  m: Membership,
  args: typeof createInput.type,
): Promise<Id<"clients">> {
  const primaries = args.emergencyContacts.filter((c) => c.isPrimary).length;
  if (args.emergencyContacts.length > 0 && primaries !== 1) {
    throw new ConvexError({
      code: "VALIDATION",
      message: "Mark exactly one emergency contact as primary.",
    });
  }
  if (args.payerId) {
    const p = await ctx.db.get(args.payerId);
    if (!p || p.agencyId !== m.agencyId) {
      throw new ConvexError({ code: "VALIDATION", message: "Unknown payer." });
    }
  }

  const ssnEncrypted = args.ssn ? await encryptField(args.ssn) : undefined;
  const dobEncrypted = args.dateOfBirth ? await encryptField(args.dateOfBirth) : undefined;
  const dobMonthDay = args.dateOfBirth ? args.dateOfBirth.slice(5) : undefined;

  const now = Date.now();
  const { ssn: _ssn, dateOfBirth: _dob, ...rest } = args;
  void _ssn;
  void _dob;

  const id = await ctx.db.insert("clients", {
    agencyId: m.agencyId,
    ...rest,
    ssnEncrypted,
    dobEncrypted,
    dobMonthDay,
    status: "intake",
    createdAt: now,
    updatedAt: now,
  });

  await logAudit(ctx, m, {
    action: "client.create",
    entityType: "clients",
    entityId: id,
    summary: "Created client (intake)",
  });
  return id;
}
