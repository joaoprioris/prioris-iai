/**
 * Lentes entre agentes (seção "Lentes que pode ativar" de cada definição de agente).
 * Não confundir com as lentes transversais do contrato (via_negativa, opcionalidade, etc.).
 * Fonte: definições dos Agentes 1 a 8 (pasta AGENTES). `null` em `intensity` = permitida sem intensidade informada.
 * Evolução não ativa lentes; influencia quais entram, com qual intensidade e prioridade de leitura.
 */
export const AGENT_IDS = ["MNT", "CTN", "PRF", "IMP", "FBK", "OTO", "CRS", "EVL"] as const;
export type AgentId = (typeof AGENT_IDS)[number];
export type LensIntensity = "leve" | "moderada" | "forte";

export interface LensRule {
  lens: AgentId;
  intensity: LensIntensity | null;
}

export interface AgentLenses {
  allowed: readonly LensRule[];
  /** Lentes expressamente proibidas na definição. */
  forbidden: readonly AgentId[];
}

export const AGENT_LENSES: Record<AgentId, AgentLenses> = {
  MNT: {
    allowed: [
      { lens: "IMP", intensity: "leve" },
      { lens: "PRF", intensity: null },
      { lens: "CTN", intensity: "leve" },
    ],
    forbidden: ["CRS", "FBK", "OTO"],
  },
  CTN: { allowed: [{ lens: "IMP", intensity: "leve" }], forbidden: ["MNT", "FBK", "OTO", "CRS"] },
  PRF: {
    allowed: [
      { lens: "MNT", intensity: "leve" },
      { lens: "IMP", intensity: "leve" },
    ],
    forbidden: ["CRS", "FBK", "OTO"],
  },
  IMP: {
    allowed: [
      { lens: "CTN", intensity: "moderada" },
      { lens: "PRF", intensity: null },
      { lens: "MNT", intensity: "leve" },
    ],
    forbidden: ["FBK", "OTO", "CRS"],
  },
  FBK: {
    allowed: [
      { lens: "IMP", intensity: "moderada" },
      { lens: "MNT", intensity: "leve" },
      { lens: "CTN", intensity: "leve" },
    ],
    forbidden: ["CRS", "OTO"],
  },
  // A definição proíbe o Mentor como lente dominante; fica fora das permitidas.
  OTO: {
    allowed: [
      { lens: "IMP", intensity: "leve" },
      { lens: "CTN", intensity: "moderada" },
      { lens: "FBK", intensity: "leve" },
    ],
    forbidden: ["MNT", "CRS"],
  },
  CRS: {
    allowed: [
      { lens: "CTN", intensity: "forte" },
      { lens: "IMP", intensity: "leve" },
    ],
    forbidden: ["MNT", "FBK", "OTO"],
  },
  EVL: { allowed: [], forbidden: [] },
};

export const lensRule = (agent: AgentId, lens: AgentId): LensRule | undefined =>
  AGENT_LENSES[agent].allowed.find((rule) => rule.lens === lens);

export const lensAllowed = (agent: AgentId, lens: AgentId): boolean => lensRule(agent, lens) !== undefined;
