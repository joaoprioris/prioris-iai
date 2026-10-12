"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// prioris-routing-consolidation-20261012/admin-fixture-entry.ts
var admin_fixture_entry_exports = {};
__export(admin_fixture_entry_exports, {
  router: () => admin_default,
  state: () => state
});
module.exports = __toCommonJS(admin_fixture_entry_exports);

// artifacts/api-server/src/routes/admin.ts
var import_express = require("express");
var import_drizzle_orm4 = require("drizzle-orm");
var import_crypto = require("crypto");

// lib/db/src/schema/organizations.ts
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_zod = require("drizzle-zod");
var organizationsTable = (0, import_pg_core.pgTable)("organizations", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  name: (0, import_pg_core.text)("name").notNull(),
  plan: (0, import_pg_core.text)("plan").default("free"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var insertOrganizationSchema = (0, import_drizzle_zod.createInsertSchema)(organizationsTable).omit({ id: true, createdAt: true });

// lib/db/src/schema/users.ts
var import_pg_core2 = require("drizzle-orm/pg-core");
var import_drizzle_zod2 = require("drizzle-zod");
var usersTable = (0, import_pg_core2.pgTable)("users", {
  id: (0, import_pg_core2.uuid)("id").primaryKey().defaultRandom(),
  organizationId: (0, import_pg_core2.uuid)("organization_id").notNull().references(() => organizationsTable.id),
  email: (0, import_pg_core2.text)("email").unique().notNull(),
  role: (0, import_pg_core2.text)("role").default("leader"),
  authToken: (0, import_pg_core2.text)("auth_token"),
  createdAt: (0, import_pg_core2.timestamp)("created_at").defaultNow()
});
var insertUserSchema = (0, import_drizzle_zod2.createInsertSchema)(usersTable).omit({ id: true, createdAt: true });

// lib/db/src/schema/sessions.ts
var import_pg_core3 = require("drizzle-orm/pg-core");
var import_drizzle_zod3 = require("drizzle-zod");
var sessionsTable = (0, import_pg_core3.pgTable)("sessions", {
  id: (0, import_pg_core3.uuid)("id").primaryKey().defaultRandom(),
  userId: (0, import_pg_core3.uuid)("user_id").notNull().references(() => usersTable.id),
  organizationId: (0, import_pg_core3.uuid)("organization_id").notNull().references(() => organizationsTable.id),
  agentType: (0, import_pg_core3.text)("agent_type").notNull(),
  context: (0, import_pg_core3.jsonb)("context").default({}),
  exchangeCount: (0, import_pg_core3.integer)("exchange_count").default(0),
  status: (0, import_pg_core3.text)("status").default("active"),
  incident: (0, import_pg_core3.boolean)("incident").default(false),
  incidentReason: (0, import_pg_core3.text)("incident_reason"),
  createdAt: (0, import_pg_core3.timestamp)("created_at").defaultNow()
});
var insertSessionSchema = (0, import_drizzle_zod3.createInsertSchema)(sessionsTable).omit({ id: true, createdAt: true });

// lib/db/src/schema/seds.ts
var import_pg_core4 = require("drizzle-orm/pg-core");
var import_drizzle_orm = require("drizzle-orm");
var import_drizzle_zod4 = require("drizzle-zod");
var sedsTable = (0, import_pg_core4.pgTable)(
  "seds",
  {
    id: (0, import_pg_core4.uuid)("id").primaryKey().defaultRandom(),
    sessionId: (0, import_pg_core4.uuid)("session_id").notNull().references(() => sessionsTable.id),
    organizationId: (0, import_pg_core4.uuid)("organization_id").notNull().references(() => organizationsTable.id),
    debtPrimary: (0, import_pg_core4.text)("debt_primary").notNull(),
    debtAdjacent: (0, import_pg_core4.text)("debt_adjacent"),
    contextType: (0, import_pg_core4.text)("context_type").notNull(),
    actor: (0, import_pg_core4.text)("actor"),
    momentCode: (0, import_pg_core4.text)("moment_code"),
    momentPhase: (0, import_pg_core4.text)("moment_phase"),
    intensity: (0, import_pg_core4.integer)("intensity"),
    confidence: (0, import_pg_core4.doublePrecision)("confidence"),
    agentSelfAssessment: (0, import_pg_core4.text)("agent_self_assessment"),
    lowConfidence: (0, import_pg_core4.boolean)("low_confidence").default(false),
    timestamp: (0, import_pg_core4.timestamp)("timestamp", { withTimezone: true }).defaultNow(),
    createdAt: (0, import_pg_core4.timestamp)("created_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core4.check)("seds_intensity_check", import_drizzle_orm.sql`${table.intensity} BETWEEN 1 AND 5`)
  ]
);
var insertSedSchema = (0, import_drizzle_zod4.createInsertSchema)(sedsTable).omit({ id: true, createdAt: true });

// lib/db/src/schema/survey_responses.ts
var import_pg_core5 = require("drizzle-orm/pg-core");
var import_drizzle_orm2 = require("drizzle-orm");
var import_drizzle_zod5 = require("drizzle-zod");
var surveyResponsesTable = (0, import_pg_core5.pgTable)(
  "survey_responses",
  {
    id: (0, import_pg_core5.uuid)("id").primaryKey().defaultRandom(),
    organizationId: (0, import_pg_core5.uuid)("organization_id").notNull().references(() => organizationsTable.id),
    questionId: (0, import_pg_core5.uuid)("question_id").notNull(),
    sessionId: (0, import_pg_core5.uuid)("session_id").references(() => sessionsTable.id),
    answerValue: (0, import_pg_core5.integer)("answer_value").notNull(),
    createdAt: (0, import_pg_core5.timestamp)("created_at").defaultNow()
  },
  (table) => [
    (0, import_pg_core5.check)("survey_responses_answer_value_check", import_drizzle_orm2.sql`${table.answerValue} BETWEEN 0 AND 4`)
  ]
);
var insertSurveyResponseSchema = (0, import_drizzle_zod5.createInsertSchema)(surveyResponsesTable).omit({ id: true, createdAt: true });

// lib/db/src/schema/survey_tracking.ts
var import_pg_core7 = require("drizzle-orm/pg-core");
var import_drizzle_zod7 = require("drizzle-zod");

// lib/db/src/schema/questions.ts
var import_pg_core6 = require("drizzle-orm/pg-core");
var import_drizzle_orm3 = require("drizzle-orm");
var import_drizzle_zod6 = require("drizzle-zod");
var questionsTable = (0, import_pg_core6.pgTable)(
  "questions",
  {
    id: (0, import_pg_core6.uuid)("id").primaryKey().defaultRandom(),
    debtId: (0, import_pg_core6.text)("debt_id").notNull(),
    text: (0, import_pg_core6.text)("text").notNull(),
    weightType: (0, import_pg_core6.text)("weight_type").notNull(),
    active: (0, import_pg_core6.boolean)("active").default(true)
  },
  (table) => [
    (0, import_pg_core6.check)("questions_weight_type_check", import_drizzle_orm3.sql`${table.weightType} IN ('I_PLUS', 'I', 'R')`)
  ]
);
var insertQuestionSchema = (0, import_drizzle_zod6.createInsertSchema)(questionsTable).omit({ id: true });

// lib/db/src/schema/survey_tracking.ts
var surveyTrackingTable = (0, import_pg_core7.pgTable)("survey_tracking", {
  id: (0, import_pg_core7.uuid)("id").primaryKey().defaultRandom(),
  userId: (0, import_pg_core7.uuid)("user_id").notNull().references(() => usersTable.id),
  questionId: (0, import_pg_core7.uuid)("question_id").notNull().references(() => questionsTable.id),
  shownAt: (0, import_pg_core7.timestamp)("shown_at", { withTimezone: true }).defaultNow()
});
var insertSurveyTrackingSchema = (0, import_drizzle_zod7.createInsertSchema)(surveyTrackingTable).omit({ id: true, shownAt: true });

// lib/db/src/schema/moment_library.ts
var import_pg_core8 = require("drizzle-orm/pg-core");
var import_drizzle_zod8 = require("drizzle-zod");
var momentLibraryTable = (0, import_pg_core8.pgTable)("moment_library", {
  id: (0, import_pg_core8.uuid)("id").primaryKey().defaultRandom(),
  momentCode: (0, import_pg_core8.text)("moment_code").unique().notNull(),
  agent: (0, import_pg_core8.text)("agent").notNull(),
  momentName: (0, import_pg_core8.text)("moment_name").notNull(),
  description: (0, import_pg_core8.text)("description"),
  debtPrimary: (0, import_pg_core8.text)("debt_primary").notNull(),
  debtAdjacent: (0, import_pg_core8.text)("debt_adjacent"),
  contextType: (0, import_pg_core8.text)("context_type").notNull(),
  triggerPhase: (0, import_pg_core8.text)("trigger_phase"),
  exampleInput: (0, import_pg_core8.text)("example_input"),
  responseNotes: (0, import_pg_core8.text)("response_notes"),
  status: (0, import_pg_core8.text)("status").default("draft")
});
var insertMomentLibrarySchema = (0, import_drizzle_zod8.createInsertSchema)(momentLibraryTable).omit({ id: true });

// prioris-routing-consolidation-20261012/admin-database-fixture.ts
var state = { queue: [], writes: [] };
var db = { select: () => ({ from: () => ({ where: async () => state.queue.shift() ?? [] }) }), insert: () => ({ values: (v) => {
  state.writes.push(v);
  return { returning: async () => [{ id: "11111111-1111-4111-8111-111111111111" }] };
} }), update: () => {
  throw Error("SESSION_CREDENTIAL_MUST_NOT_BE_REPLACED");
} };

// artifacts/api-server/src/lib/logger.ts
var import_pino = __toESM(require("pino"), 1);
var isProduction = process.env.NODE_ENV === "production";
var logger = (0, import_pino.default)({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']"
  ],
  ...isProduction ? {} : {
    transport: {
      target: "pino-pretty",
      options: { colorize: true }
    }
  }
});

// artifacts/api-server/src/routes/admin.ts
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var router = (0, import_express.Router)();
function requireAdminToken(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    logger.error("ADMIN_TOKEN env var is not set \u2014 admin routes are disabled");
    res.status(503).json({ error: "Admin access not configured." });
    return;
  }
  const authHeader = req.headers.authorization ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const expectedBytes = Buffer.from(adminToken);
  const providedBytes = Buffer.from(provided);
  if (!provided || providedBytes.length !== expectedBytes.length || !(0, import_crypto.timingSafeEqual)(providedBytes, expectedBytes)) {
    res.status(401).json({ error: "Token de administrador inv\xE1lido." });
    return;
  }
  next();
}
router.post(
  "/admin/users",
  requireAdminToken,
  async (req, res) => {
    const { email: suppliedEmail, organization_id } = req.body ?? {};
    const email = typeof suppliedEmail === "string" ? suppliedEmail.trim().toLowerCase() : suppliedEmail;
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "E-mail inv\xE1lido." });
      return;
    }
    if (typeof organization_id !== "string" || !UUID_RE.test(organization_id)) {
      res.status(400).json({ error: "organization_id deve ser um UUID v\xE1lido." });
      return;
    }
    const [org] = await db.select({ id: organizationsTable.id, name: organizationsTable.name }).from(organizationsTable).where((0, import_drizzle_orm4.eq)(organizationsTable.id, organization_id));
    if (!org) {
      res.status(404).json({ error: `Organiza\xE7\xE3o ${organization_id} n\xE3o encontrada.` });
      return;
    }
    const [existing] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, organizationId: usersTable.organizationId }).from(usersTable).where((0, import_drizzle_orm4.eq)(usersTable.email, email));
    let userId;
    if (existing) {
      if (existing.organizationId !== organization_id) {
        res.status(409).json({ error: "Este e-mail j\xE1 pertence a outra organiza\xE7\xE3o." });
        return;
      }
      userId = existing.id;
      req.log.info({ userId }, "Admin: usu\xE1rio j\xE1 cadastrado; credencial preservada");
    } else {
      const [created] = await db.insert(usersTable).values({ email, organizationId: organization_id, authToken: null, role: "leader" }).returning({ id: usersTable.id });
      userId = created.id;
      req.log.info({ userId }, "Admin: novo usu\xE1rio criado");
    }
    res.status(existing ? 200 : 201).json({
      user: {
        id: userId,
        email,
        organizationId: organization_id,
        organizationName: org.name,
        isNew: !existing
      },
      loginRequired: true
    });
  }
);
var admin_default = router;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  router,
  state
});
