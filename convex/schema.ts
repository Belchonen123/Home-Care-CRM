import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/* ===========================================================================
 * Indexes — what queries each one serves. Add a comment when you add an index.
 * ---------------------------------------------------------------------------
 * agencies        by_clerk_org              org-switch lookup on every request
 * agencies        by_name                   admin search
 * users           by_clerk_user             auth -> user row mapping
 * memberships     by_agency                 staff list per agency
 * memberships     by_clerk_org_user         single-membership resolution per req
 * memberships     by_user                   org switcher dropdown
 * payers          by_agency                 settings list
 * payers          by_agency_active          dropdown filter on auth-create form
 * clients         by_agency_status          list page filtered by status
 * clients         by_agency_lastname        alphabetical search/list
 * clients         by_agency_medicaid        lookup by Medicaid ID
 * caregivers      by_agency_status          list page filtered by status
 * caregivers      by_agency_lastname        alphabetical search/list
 * caregivers      by_membership             "current user is which caregiver"
 * credentials     by_caregiver              caregiver detail tab
 * credentials     by_agency_expires         daily expiry-scan cron
 * authorizations  by_agency_client          client detail "Authorizations" tab
 * authorizations  by_agency_status_end      cron: expiring soon
 * authorizations  by_external               dedupe on (agency, ext-auth-number)
 * plansOfCare     by_agency_client          client detail "Plan of Care" tab
 * plansOfCare     by_authorization          POC editor (auth -> active POC)
 * visits          by_agency_scheduled       scheduler grid time-range query
 * visits          by_agency_client_scheduled  client visit history
 * visits          by_agency_caregiver_scheduled  caregiver day view
 * visits          by_agency_status          live board (in_progress/missed)
 * visits          by_agency_evv_status      EVV exception queue, submission feed
 * scheduleTemplates by_agency_active        cron: rolling-window materializer
 * scheduleTemplates by_authorization        validation on auth changes
 * evvSubmissions  by_agency_date            submission-health dashboard
 * evvSubmissions  by_status_next_attempt    retry cron
 * documents       by_client / by_caregiver / by_authorization / by_agency
 * geocodeCache    by_address_hash           dedupe Mapbox calls
 * alerts          by_agency_unack           bell-icon unread feed
 * alerts          by_agency_kind            dedupe before raising new alert
 * auditLog        by_agency_at              compliance log timeline
 * auditLog        by_agency_target          per-record timeline tab
 * auditLog        by_actor                  user-attributed search
 * ===========================================================================
 *
 * Tenant rule: every table except `agencies`, `users`, and `geocodeCache`
 * carries `agencyId` and its first index segment is `agencyId`. Access helpers
 * (`convex/lib/access.ts`) enforce that the caller's active membership matches
 * before any read or write.
 *
 * PHI rule: SSN and standalone full DOB are stored in `*_encrypted` fields and
 * encrypted via `convex/lib/crypto.ts` (`encryptField` / `decryptField`).
 *
 * Soft-delete rule: every PHI-bearing table carries `deletedAt` + `deletedBy`.
 * Hard delete requires the `owner` role + a written reason + an audit entry.
 */

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

const stateCode = v.union(v.literal("NY"), v.literal("MI"));

const role = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("scheduler"),
  v.literal("intake"),
  v.literal("biller"),
  v.literal("compliance"),
  v.literal("caregiver"),
  v.literal("viewer"),
);

const program = v.union(
  v.literal("ny_mltc"),
  v.literal("ny_cdpap"),
  v.literal("ny_private_pay"),
  v.literal("mi_home_help"),
  v.literal("mi_mi_choice"),
  v.literal("mi_private_pay"),
);

const aggregator = v.union(
  v.literal("hhaexchange"),
  v.literal("sandata"),
  v.literal("champs"),
  v.literal("none"),
);

const evvException = v.object({
  kind: v.union(
    v.literal("late_clock_in"),
    v.literal("early_clock_out"),
    v.literal("missed"),
    v.literal("geofence"),
    v.literal("missing_signature"),
    v.literal("manual_edit"),
    v.literal("other"),
  ),
  reasonCode: v.optional(v.string()),
  note: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  resolvedBy: v.optional(v.id("users")),
});

const clockEvent = v.object({
  lat: v.number(),
  lng: v.number(),
  accuracyMeters: v.number(),
  capturedAt: v.number(),
  offlineCaptured: v.boolean(),
});

export default defineSchema({
  /* --------------------------- tenants & users --------------------------- */

  agencies: defineTable({
    /** One Clerk Organization == one agency. */
    clerkOrgId: v.string(),
    name: v.string(),
    legalName: v.optional(v.string()),
    states: v.array(stateCode),
    programs: v.array(program),
    npi: v.optional(v.string()),
    taxId: v.optional(v.string()),
    addresses: v.array(usAddress),
    billingContact: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
    }),
    providerIds: v.object({
      champsProviderId: v.optional(v.string()),
      hhaxProviderIds: v.optional(
        v.array(v.object({ mltc: v.string(), id: v.string() })),
      ),
      sandataAccountId: v.optional(v.string()),
    }),
    settings: v.object({
      geofenceRadiusMeters: v.number(),
      lateClockInToleranceMinutes: v.number(),
      missedVisitGraceMinutes: v.number(),
      idleSessionTimeoutMinutes: v.number(),
      timezone: v.string(),
      consumerLabel: v.string(),
      caregiverLabel: v.string(),
    }),
    /** BAA acknowledgment captured during onboarding (Prompt 6). */
    baaAcknowledgedAt: v.optional(v.number()),
    baaAcknowledgedByUserId: v.optional(v.id("users")),
    baaAcknowledgedFromIp: v.optional(v.string()),
    onboardingComplete: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_org", ["clerkOrgId"])
    .index("by_name", ["name"]),

  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    avatarUrl: v.optional(v.string()),
    locale: v.optional(v.string()),
    deactivatedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_clerk_user", ["clerkUserId"]),

  memberships: defineTable({
    agencyId: v.id("agencies"),
    userId: v.id("users"),
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role,
    caregiverId: v.optional(v.id("caregivers")),
    invitedBy: v.optional(v.id("users")),
    invitedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_clerk_org_user", ["clerkOrgId", "clerkUserId"])
    .index("by_user", ["clerkUserId"]),

  /* ------------------------------- payers -------------------------------- */

  payers: defineTable({
    agencyId: v.id("agencies"),
    name: v.string(),
    kind: v.union(
      v.literal("mltc"),
      v.literal("mco"),
      v.literal("medicaid_ffs"),
      v.literal("private_pay"),
      v.literal("vet_admin"),
      v.literal("ltc_insurance"),
    ),
    aggregator,
    aggregatorAccountId: v.optional(v.string()),
    payerIdExternal: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_agency_active", ["agencyId", "isActive"]),

  /* ------------------------------- clients ------------------------------- */

  clients: defineTable({
    agencyId: v.id("agencies"),
    firstName: v.string(),
    lastName: v.string(),
    middleName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    pronouns: v.optional(v.string()),
    /** Encrypted full DOB. Caregiver-scoped views see only `dobMonthDay`. */
    dobEncrypted: v.optional(v.string()),
    dobMonthDay: v.optional(v.string()),
    ssnEncrypted: v.optional(v.string()),
    medicaidId: v.optional(v.string()),
    medicareId: v.optional(v.string()),
    languages: v.array(v.string()),
    primaryLanguage: v.optional(v.string()),
    serviceAddress: usAddress,
    mailingAddress: v.optional(usAddress),
    phones: v.array(phoneEntry),
    email: v.optional(v.string()),
    emergencyContacts: v.array(
      v.object({
        name: v.string(),
        relationship: v.string(),
        phone: v.string(),
        email: v.optional(v.string()),
        isPrimary: v.boolean(),
      }),
    ),
    program,
    isCdpapConsumer: v.optional(v.boolean()),
    payerId: v.optional(v.id("payers")),
    caseManagerName: v.optional(v.string()),
    caseManagerEmail: v.optional(v.string()),
    caseManagerPhone: v.optional(v.string()),
    intakeNotes: v.optional(v.string()),
    status: v.union(
      v.literal("intake"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("discharged"),
    ),
    statusReason: v.optional(v.string()),
    startOfCareDate: v.optional(v.string()),
    dischargeDate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deletedReason: v.optional(v.string()),
  })
    .index("by_agency_status", ["agencyId", "status"])
    .index("by_agency_lastname", ["agencyId", "lastName"])
    .index("by_agency_medicaid", ["agencyId", "medicaidId"]),

  /* ----------------------------- caregivers ------------------------------ */

  caregivers: defineTable({
    agencyId: v.id("agencies"),
    membershipId: v.optional(v.id("memberships")),
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
    dobEncrypted: v.optional(v.string()),
    ssnEncrypted: v.optional(v.string()),
    languages: v.array(v.string()),
    address: v.optional(usAddress),
    phone: v.string(),
    email: v.optional(v.string()),
    ivrPinHash: v.optional(v.string()),
    classifications: v.array(
      v.union(
        v.literal("hha"),
        v.literal("pca"),
        v.literal("cna"),
        v.literal("dcw"),
        v.literal("companion"),
      ),
    ),
    employmentType: v.union(v.literal("employee"), v.literal("contractor")),
    hireDate: v.optional(v.string()),
    terminationDate: v.optional(v.string()),
    payRate: v.optional(v.number()),
    overtimeMultiplier: v.optional(v.number()),
    availability: v.array(
      v.object({
        dayOfWeek: v.number(),
        startMinute: v.number(),
        endMinute: v.number(),
      }),
    ),
    maxWeeklyHours: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("applicant"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("terminated"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deletedReason: v.optional(v.string()),
  })
    .index("by_agency_status", ["agencyId", "status"])
    .index("by_agency_lastname", ["agencyId", "lastName"])
    .index("by_membership", ["membershipId"]),

  /* ----------------------------- credentials ----------------------------- */

  credentials: defineTable({
    agencyId: v.id("agencies"),
    caregiverId: v.id("caregivers"),
    kind: v.union(
      v.literal("hha_certification"),
      v.literal("pca_certification"),
      v.literal("cna_certification"),
      v.literal("dcw_training"),
      v.literal("cpr"),
      v.literal("first_aid"),
      v.literal("tb_test"),
      v.literal("physical"),
      v.literal("background_check"),
      v.literal("driver_license"),
      v.literal("auto_insurance"),
      v.literal("i9"),
      v.literal("w4"),
      v.literal("other"),
    ),
    label: v.optional(v.string()),
    issuer: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    issuedDate: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    alertsSent: v.array(v.union(v.literal("30"), v.literal("14"), v.literal("7"))),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_caregiver", ["caregiverId"])
    .index("by_agency_expires", ["agencyId", "expiresAt"]),

  /* --------------------------- authorizations ---------------------------- */

  authorizations: defineTable({
    agencyId: v.id("agencies"),
    clientId: v.id("clients"),
    payerId: v.id("payers"),
    externalAuthNumber: v.string(),
    serviceCode: v.string(),
    serviceDescription: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    unitMinutes: v.number(),
    authorizedUnits: v.number(),
    consumedUnits: v.number(),
    weeklyMaxUnits: v.optional(v.number()),
    monthlyMaxUnits: v.optional(v.number()),
    diagnoses: v.array(v.string()),
    miTaskCategoryMinutes: v.optional(
      v.array(v.object({ category: v.string(), minutes: v.number() })),
    ),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("expired"),
      v.literal("voided"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_agency_client", ["agencyId", "clientId"])
    .index("by_agency_status_end", ["agencyId", "status", "endDate"])
    .index("by_external", ["agencyId", "externalAuthNumber"]),

  /* ----------------------------- plans of care --------------------------- */

  plansOfCare: defineTable({
    agencyId: v.id("agencies"),
    clientId: v.id("clients"),
    authorizationId: v.id("authorizations"),
    effectiveStart: v.string(),
    effectiveEnd: v.optional(v.string()),
    tasks: v.array(
      v.object({
        code: v.string(),
        label: v.string(),
        category: v.string(),
        frequency: v.union(
          v.literal("each_visit"),
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("as_needed"),
        ),
        instructions: v.optional(v.string()),
        authorizedMinutes: v.optional(v.number()),
      }),
    ),
    authoredBy: v.id("users"),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("superseded")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_agency_client", ["agencyId", "clientId"])
    .index("by_authorization", ["authorizationId"]),

  /* ------------------------------- visits -------------------------------- */

  visits: defineTable({
    agencyId: v.id("agencies"),
    clientId: v.id("clients"),
    caregiverId: v.id("caregivers"),
    authorizationId: v.id("authorizations"),
    planOfCareId: v.optional(v.id("plansOfCare")),
    serviceCode: v.string(),
    serviceLocation: usAddress,

    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    actualStart: v.optional(v.number()),
    actualEnd: v.optional(v.number()),

    clockInMethod: v.optional(
      v.union(
        v.literal("mobile"),
        v.literal("ivr"),
        v.literal("fob"),
        v.literal("manual"),
      ),
    ),
    clockOutMethod: v.optional(
      v.union(
        v.literal("mobile"),
        v.literal("ivr"),
        v.literal("fob"),
        v.literal("manual"),
      ),
    ),
    clockInLocation: v.optional(clockEvent),
    clockOutLocation: v.optional(clockEvent),
    deviceId: v.optional(v.string()),
    callerId: v.optional(v.string()),

    taskCompletions: v.array(
      v.object({
        code: v.string(),
        completed: v.boolean(),
        skippedReason: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
    caregiverNotes: v.optional(v.string()),
    clientSignatureStorageId: v.optional(v.id("_storage")),

    status: v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("missed"),
      v.literal("cancelled"),
    ),
    cancellationReason: v.optional(v.string()),

    evvStatus: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("ready"),
      v.literal("exception"),
      v.literal("submitted"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    evvExceptions: v.array(evvException),

    aggregatorSubmissionId: v.optional(v.id("evvSubmissions")),

    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_agency_scheduled", ["agencyId", "scheduledStart"])
    .index("by_agency_client_scheduled", ["agencyId", "clientId", "scheduledStart"])
    .index("by_agency_caregiver_scheduled", [
      "agencyId",
      "caregiverId",
      "scheduledStart",
    ])
    .index("by_agency_status", ["agencyId", "status"])
    .index("by_agency_evv_status", ["agencyId", "evvStatus"]),

  /* ----------------------- recurring schedule templates ------------------ */

  scheduleTemplates: defineTable({
    agencyId: v.id("agencies"),
    clientId: v.id("clients"),
    caregiverId: v.id("caregivers"),
    authorizationId: v.id("authorizations"),
    serviceCode: v.string(),
    rule: v.object({
      kind: v.literal("weekly"),
      daysOfWeek: v.array(v.number()),
      startMinute: v.number(),
      durationMinutes: v.number(),
    }),
    startsOn: v.string(),
    endsOn: v.optional(v.string()),
    materializedThrough: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agency_active", ["agencyId", "isActive"])
    .index("by_authorization", ["authorizationId"]),

  /* --------------------------- EVV submissions --------------------------- */

  evvSubmissions: defineTable({
    agencyId: v.id("agencies"),
    aggregator,
    forDate: v.string(),
    visitCount: v.number(),
    submittedAt: v.optional(v.number()),
    response: v.optional(
      v.object({
        ok: v.boolean(),
        accepted: v.number(),
        rejected: v.number(),
        errors: v.array(
          v.object({
            visitId: v.id("visits"),
            code: v.string(),
            message: v.string(),
          }),
        ),
      }),
    ),
    attemptCount: v.number(),
    nextAttemptAt: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("submitting"),
      v.literal("succeeded"),
      v.literal("partial"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agency_date", ["agencyId", "forDate"])
    .index("by_status_next_attempt", ["status", "nextAttemptAt"]),

  /* ------------------------------ documents ------------------------------ */

  documents: defineTable({
    agencyId: v.id("agencies"),
    clientId: v.optional(v.id("clients")),
    caregiverId: v.optional(v.id("caregivers")),
    authorizationId: v.optional(v.id("authorizations")),
    kind: v.string(),
    label: v.string(),
    storageId: v.id("_storage"),
    sizeBytes: v.number(),
    mimeType: v.string(),
    uploadedBy: v.id("users"),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_client", ["clientId"])
    .index("by_caregiver", ["caregiverId"])
    .index("by_authorization", ["authorizationId"])
    .index("by_agency", ["agencyId"]),

  /* ---------------------------- geocode cache ---------------------------- */

  geocodeCache: defineTable({
    /** Hash of normalized address (line1|city|state|postalCode), tenant-agnostic. */
    addressHash: v.string(),
    lat: v.number(),
    lng: v.number(),
    provider: v.string(), // "mapbox" | "google"
    cachedAt: v.number(),
  }).index("by_address_hash", ["addressHash"]),

  /* ------------------------------- alerts -------------------------------- */

  alerts: defineTable({
    agencyId: v.id("agencies"),
    kind: v.union(
      v.literal("credential_expiring"),
      v.literal("credential_expired"),
      v.literal("authorization_expiring"),
      v.literal("authorization_exhausted"),
      v.literal("missed_visit"),
      v.literal("late_clock_in"),
      v.literal("evv_submission_failed"),
    ),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    title: v.string(),
    body: v.string(),
    targetClientId: v.optional(v.id("clients")),
    targetCaregiverId: v.optional(v.id("caregivers")),
    targetCredentialId: v.optional(v.id("credentials")),
    targetAuthorizationId: v.optional(v.id("authorizations")),
    targetVisitId: v.optional(v.id("visits")),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_agency_unack", ["agencyId", "acknowledgedAt"])
    .index("by_agency_kind", ["agencyId", "kind"]),

  /* ------------------------------ audit log ------------------------------ */

  auditLog: defineTable({
    agencyId: v.id("agencies"),
    actorUserId: v.optional(v.id("users")),
    actorClerkUserId: v.optional(v.string()),
    actorRole: v.optional(role),
    action: v.string(),
    targetTable: v.optional(v.string()),
    targetId: v.optional(v.string()),
    summary: v.optional(v.string()),
    fieldChanges: v.optional(v.array(v.string())),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_agency_at", ["agencyId", "at"])
    .index("by_agency_target", ["agencyId", "targetTable", "targetId"])
    .index("by_actor", ["actorClerkUserId", "at"]),
});
