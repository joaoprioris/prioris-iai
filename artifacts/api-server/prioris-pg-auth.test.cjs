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

// artifacts/api-server/prioris-pg-auth.test.ts
var import_strict = __toESM(require("node:assert/strict"), 1);
var import_node_crypto2 = require("node:crypto");

// lib/db/src/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = __toESM(require("pg"), 1);

// lib/db/src/schema/index.ts
var schema_exports = {};
__export(schema_exports, {
  insertMomentLibrarySchema: () => insertMomentLibrarySchema,
  insertOrganizationSchema: () => insertOrganizationSchema,
  insertQuestionSchema: () => insertQuestionSchema,
  insertSedSchema: () => insertSedSchema,
  insertSessionSchema: () => insertSessionSchema,
  insertSurveyResponseSchema: () => insertSurveyResponseSchema,
  insertSurveyTrackingSchema: () => insertSurveyTrackingSchema,
  insertUserSchema: () => insertUserSchema,
  momentLibraryTable: () => momentLibraryTable,
  organizationsTable: () => organizationsTable,
  questionsTable: () => questionsTable,
  sedsTable: () => sedsTable,
  sessionsTable: () => sessionsTable,
  surveyResponsesTable: () => surveyResponsesTable,
  surveyTrackingTable: () => surveyTrackingTable,
  usersTable: () => usersTable
});

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

// lib/db/src/index.ts
var { Pool } = import_pg.default;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// artifacts/api-server/src/lib/auth-repository.ts
var import_drizzle_orm4 = require("drizzle-orm");

// artifacts/api-server/src/lib/auth-state.ts
var import_node_crypto = require("node:crypto");
var LOGIN_TTL_MS = 10 * 60 * 1e3;
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var emptyAuthState = () => ({ v: 2, pending: null, session: null });
var isOpaqueToken = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var digestToken = (token) => (0, import_node_crypto.createHash)("sha256").update(token).digest("hex");
var newToken = () => (0, import_node_crypto.randomBytes)(32).toString("hex");
function validCredential(value) {
  if (!value || typeof value !== "object") return false;
  const c = value;
  return isOpaqueToken(c.hash) && Number.isSafeInteger(c.expiresAt) && c.expiresAt > 0;
}
function parseAuthState(value) {
  if (!value) return null;
  try {
    const state = JSON.parse(value);
    if (state?.v !== 2 || !(state.pending === null || validCredential(state.pending)) || !(state.session === null || validCredential(state.session))) return null;
    return state;
  } catch {
    return null;
  }
}
function serializeAuthState(state) {
  const copy = (c) => c ? { hash: c.hash, expiresAt: c.expiresAt } : null;
  return JSON.stringify({ v: 2, pending: copy(state.pending), session: copy(state.session) });
}
function credentialMatches(state, kind, token, now = Date.now()) {
  if (!state || !isOpaqueToken(token)) return false;
  const credential = state[kind];
  if (!credential || credential.expiresAt <= now) return false;
  return (0, import_node_crypto.timingSafeEqual)(Buffer.from(credential.hash, "hex"), Buffer.from(digestToken(token), "hex"));
}
function issueLogin(state, token, now = Date.now()) {
  return { v: 2, pending: { hash: digestToken(token), expiresAt: now + LOGIN_TTL_MS }, session: state.session && state.session.expiresAt > now ? state.session : null };
}
function issueSession(token, now = Date.now()) {
  return { v: 2, pending: null, session: { hash: digestToken(token), expiresAt: now + SESSION_TTL_MS } };
}

// artifacts/api-server/src/lib/auth-repository.ts
var columns = { id: usersTable.id, email: usersTable.email, role: usersTable.role, organizationId: usersTable.organizationId, organizationName: organizationsTable.name, authToken: usersTable.authToken };
var base = () => db.select(columns).from(usersTable).innerJoin(organizationsTable, (0, import_drizzle_orm4.eq)(usersTable.organizationId, organizationsTable.id));
var authRepository = {
  async byEmail(email) {
    const [row] = await base().where(import_drizzle_orm4.sql`lower(${usersTable.email}) = ${email}`).limit(1);
    return row ?? null;
  },
  async byCredential(kind, hash) {
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    const pattern = '%"' + kind + '":{"hash":"' + hash + '"%';
    const [row] = await base().where((0, import_drizzle_orm4.like)(usersTable.authToken, pattern)).limit(1);
    return row ?? null;
  },
  async swap(id, before, after) {
    const [row] = await db.update(usersTable).set({ authToken: after ? serializeAuthState(after) : null }).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(usersTable.id, id), before === null ? (0, import_drizzle_orm4.isNull)(usersTable.authToken) : (0, import_drizzle_orm4.eq)(usersTable.authToken, before))).returning({ id: usersTable.id });
    return Boolean(row);
  }
};

// artifacts/api-server/prioris-pg-auth.test.ts
if (!process.env.DATABASE_URL?.includes(".prioris-auth-test")) throw Error("ISOLATED_DATABASE_REQUIRED");
(async () => {
  let failed = 0, passed = 0;
  const check4 = async (name, fn) => {
    try {
      await fn();
      passed++;
      console.log("PASS", name);
    } catch {
      failed++;
      console.log("FAIL", name);
    }
  };
  try {
    const org = (await pool.query("INSERT INTO organizations(name) VALUES($1) RETURNING id", ["FIXTURE FICTICIA - TESTE POSTGRES"])).rows[0].id;
    const email = "Fixture-" + (0, import_node_crypto2.randomUUID)() + "@example.invalid";
    const uid = (await pool.query("INSERT INTO users(organization_id,email) VALUES($1,$2) RETURNING id", [org, email])).rows[0].id;
    const token = newToken(), first = issueLogin(emptyAuthState(), token);
    await check4("consulta_normalizada_com_SQL_real", async () => import_strict.default.equal((await authRepository.byEmail(email.toLowerCase()))?.id, uid));
    await check4("grava_codigo_pendente_com_SQL_real", async () => import_strict.default.equal(await authRepository.swap(uid, null, first), true));
    await check4("pesquisa_hash_e_preserva_empresa", async () => {
      const row = await authRepository.byCredential("pending", digestToken(token));
      import_strict.default.equal(row?.id, uid);
      import_strict.default.equal(row?.organizationId, org);
    });
    await check4("codigo_bruto_nao_gravado", async () => {
      const row = await authRepository.byEmail(email.toLowerCase());
      (0, import_strict.default)(!row?.authToken?.includes(token));
      (0, import_strict.default)(credentialMatches(parseAuthState(row?.authToken), "pending", token));
    });
    await check4("atualizacao_desatualizada_rejeitada", async () => import_strict.default.equal(await authRepository.swap(uid, null, first), false));
    const sessionTokens = [newToken(), newToken()];
    let outcomes = [];
    await check4("duas_conexoes_confirmam_apenas_uma_vez", async () => {
      outcomes = await Promise.all(sessionTokens.map((t) => authRepository.swap(uid, serializeAuthState(first), issueSession(t))));
      import_strict.default.equal(outcomes.filter(Boolean).length, 1);
    });
    const winner = sessionTokens[outcomes.indexOf(true)];
    let current = null;
    await check4("confirmacao_remove_pendente_e_cria_sessao", async () => {
      import_strict.default.equal(await authRepository.byCredential("pending", digestToken(token)), null);
      const row = await authRepository.byCredential("session", digestToken(winner));
      import_strict.default.equal(row?.id, uid);
      current = row.authToken;
      (0, import_strict.default)(credentialMatches(parseAuthState(current), "session", winner));
    });
    await check4("sessao_vencida_e_recusada", async () => {
      const state = parseAuthState(current);
      (0, import_strict.default)(!credentialMatches(state, "session", winner, state.session.expiresAt));
      import_strict.default.equal(state.session.expiresAt - Date.now() > SESSION_TTL_MS, false);
    });
    await check4("revogacao_remove_acesso_no_SQL_real", async () => {
      (0, import_strict.default)(await authRepository.swap(uid, current, emptyAuthState()));
      import_strict.default.equal(await authRepository.byCredential("session", digestToken(winner)), null);
    });
    await check4("empresa_inexistente_viola_integridade", async () => {
      let rejected = false;
      try {
        await pool.query("INSERT INTO users(organization_id,email) VALUES($1,$2)", [(0, import_node_crypto2.randomUUID)(), (0, import_node_crypto2.randomUUID)() + "@example.invalid"]);
      } catch (e) {
        rejected = e.code === "23503";
      }
      (0, import_strict.default)(rejected);
    });
    const owner = await authRepository.byEmail("joao.mendonca@prioris.com.br"), ownerState = parseAuthState(owner?.authToken);
    console.log("FLUXO_REAL_COM_ESTADO_PERSISTIDO_E_REVOGADO", Boolean(ownerState && ownerState.pending === null && ownerState.session === null));
    console.log(passed + "/" + (passed + failed) + " testes PostgreSQL real, exclusivamente no banco isolado.");
    process.exitCode = failed ? 1 : 0;
  } catch {
    console.log("FALHA_NO_TESTE_ISOLADO");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
