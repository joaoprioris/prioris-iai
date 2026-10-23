import { Rejected } from "./errors.ts";

export const SCHEMA_VERSION = 3;
export const CONTEXTS = ["conflito", "decisao", "alinhamento", "feedback", "crise"] as const;
export const ACTORS = ["time", "par", "liderado", "chefe", "cliente"] as const;
export const MOMENTS = ["Antes", "Durante", "Depois", "Padrao", "Vazio"] as const;
export const INTENSITIES = ["Baixa", "Media", "Alta"] as const;
export const MAX_FUTURE_SKEW_SECONDS = 300;

export interface SedEvent {
  kind: "sed";
  event_id: string;
  occurred: Date;
  group_id: number;
  contributor_token: string;
  debt_principal: number;
  debt_adjacent: number | null;
  context: (typeof CONTEXTS)[number];
  actor: (typeof ACTORS)[number];
  momento: (typeof MOMENTS)[number];
  intensity_proxy: (typeof INTENSITIES)[number];
}

export interface SurveyAnswer {
  kind: "survey";
  event_id: string;
  occurred: Date;
  group_id: number;
  contributor_token: string;
  question_id: string;
  answer: number;
}

export type ValidEvent = SedEvent | SurveyAnswer;

const COMMON = ["schema_version", "kind", "event_id", "timestamp", "client_id", "group_id", "contributor_token"];
const SED_FIELDS = new Set([
  ...COMMON,
  "debt_principal",
  "debt_adjacent",
  "context",
  "actor",
  "momento",
  "intensity_proxy",
]);
const SURVEY_FIELDS = new Set([...COMMON, "question_id", "answer"]);
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Rejected(`invalid ${label}`);
  return value as T[number];
}

function parseTimestamp(value: unknown, now: number): Date {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) throw new Rejected("invalid timestamp");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Rejected("invalid timestamp");
  if (date.getTime() / 1000 > now + MAX_FUTURE_SKEW_SECONDS) throw new Rejected("future timestamp");
  return date;
}

/** Valida o payload já autenticado. `tenant` vem do cadastro de credenciais, nunca do corpo. */
export function validateEvent(payload: unknown, tenant: string, now: number): ValidEvent {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new Rejected("invalid payload");
  const body = payload as Record<string, unknown>;
  const kind = body.kind;
  if (kind !== "sed" && kind !== "survey") throw new Rejected("unsupported kind");
  const allowed = kind === "sed" ? SED_FIELDS : SURVEY_FIELDS;
  const keys = Object.keys(body);
  if (keys.length !== allowed.size || !keys.every((key) => allowed.has(key))) throw new Rejected("invalid fields");
  if (body.schema_version !== SCHEMA_VERSION) throw new Rejected("unsupported schema version");
  if (body.client_id !== tenant) throw new Rejected("tenant mismatch");
  const eventId = body.event_id;
  if (typeof eventId !== "string" || eventId.length < 1 || eventId.length > 100) throw new Rejected("invalid event id");
  if (!isInt(body.group_id, 1, 2147483647)) throw new Rejected("invalid group id");
  const token = body.contributor_token;
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) throw new Rejected("invalid contributor token");
  const occurred = parseTimestamp(body.timestamp, now);
  const common = { event_id: eventId, occurred, group_id: body.group_id, contributor_token: token };

  if (kind === "survey") {
    if (typeof body.question_id !== "string" || !/^[A-H][1-6]$/.test(body.question_id))
      throw new Rejected("invalid question id");
    if (!isInt(body.answer, 0, 4)) throw new Rejected("invalid answer");
    return { kind, ...common, question_id: body.question_id, answer: body.answer };
  }

  if (!isInt(body.debt_principal, 1, 10)) throw new Rejected("invalid principal debt");
  let adjacent: number | null = null;
  if (body.debt_adjacent !== null) {
    if (!isInt(body.debt_adjacent, 1, 10)) throw new Rejected("invalid adjacent debt");
    if (body.debt_adjacent === body.debt_principal) throw new Rejected("adjacent equals principal");
    adjacent = body.debt_adjacent;
  }
  return {
    kind,
    ...common,
    debt_principal: body.debt_principal,
    debt_adjacent: adjacent,
    context: oneOf(body.context, CONTEXTS, "context"),
    actor: oneOf(body.actor, ACTORS, "actor"),
    momento: oneOf(body.momento, MOMENTS, "momento"),
    intensity_proxy: oneOf(body.intensity_proxy, INTENSITIES, "intensity"),
  };
}

/** Ciclo de apuração: primeiro dia do mês UTC. */
export function cycleStart(occurred: Date): string {
  return `${occurred.getUTCFullYear()}-${String(occurred.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
