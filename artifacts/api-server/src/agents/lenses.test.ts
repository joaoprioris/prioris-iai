import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { AGENT_IDS, AGENT_LENSES, lensAllowed, lensRule, type AgentId, type LensIntensity } from "./lenses.ts";

const contract = JSON.parse(readFileSync(new URL("../lib/agent-contract.json", import.meta.url), "utf8")) as {
  agents: { id: AgentId; prompt: string }[];
};

const NAMES: [RegExp, AgentId][] = [
  [/^Mentor/, "MNT"],
  [/^Conten/, "CTN"],
  [/^Perfil/, "PRF"],
  [/^Impacto/, "IMP"],
  [/^Feedback/, "FBK"],
  [/^1:1/, "OTO"],
  [/^Crisis/, "CRS"],
];
const INTENSITY: Record<string, LensIntensity> = { leve: "leve", moderado: "moderada", forte: "forte" };

/** Lê o bloco AGENT_LENSES do prompt do contrato existente. */
function parseBlock(prompt: string) {
  const block = /AGENT_LENSES:\n([\s\S]*?)\nLIMITS:/.exec(prompt)?.[1] ?? "";
  const lines = block
    .split("\n")
    .map((line) => line.replace(/[✔️❌⚠️]/gu, "").trim())
    .filter(Boolean);
  const allowed: { lens: AgentId; intensity: LensIntensity | null }[] = [];
  const forbidden: AgentId[] = [];
  let section: "allowed" | "forbidden" | null = null;
  for (const line of lines) {
    if (/^Pode usar/.test(line)) section = "allowed";
    else if (/^Não pode usar/.test(line)) section = "forbidden";
    else if (section) {
      const lens = NAMES.find(([pattern]) => pattern.test(line))?.[1];
      if (!lens) continue;
      const word = /\((\w+)\)/.exec(line)?.[1];
      if (section === "allowed") allowed.push({ lens, intensity: word ? (INTENSITY[word] ?? null) : null });
      else forbidden.push(lens);
    }
  }
  return { allowed, forbidden };
}

describe("matriz de lentes entre agentes", () => {
  it("é coerente: sem lente própria e sem lente ao mesmo tempo permitida e proibida", () => {
    for (const agent of AGENT_IDS) {
      const { allowed, forbidden } = AGENT_LENSES[agent];
      for (const rule of allowed) {
        assert.notEqual(rule.lens, agent, agent);
        assert.ok(!forbidden.includes(rule.lens), `${agent}: ${rule.lens} permitida e proibida`);
      }
      assert.ok(!forbidden.includes(agent), agent);
    }
  });

  it("Feedback usa Impacto moderada, Mentor leve e Contenção leve, e nunca Crises nem 1:1", () => {
    assert.equal(lensRule("FBK", "IMP")?.intensity, "moderada");
    assert.equal(lensRule("FBK", "MNT")?.intensity, "leve");
    assert.equal(lensRule("FBK", "CTN")?.intensity, "leve");
    assert.equal(lensAllowed("FBK", "CRS"), false);
    assert.equal(lensAllowed("FBK", "OTO"), false);
  });

  it("Evolução não ativa lentes; Contenção só aceita Impacto leve; Crises usa Contenção forte", () => {
    assert.deepEqual(AGENT_LENSES.EVL.allowed, []);
    assert.deepEqual(AGENT_LENSES.CTN.allowed, [{ lens: "IMP", intensity: "leve" }]);
    assert.equal(lensRule("CRS", "CTN")?.intensity, "forte");
  });

  it("confere com o bloco AGENT_LENSES de cada agente no contrato existente", () => {
    for (const agent of contract.agents) {
      if (agent.id === "EVL") continue;
      const parsed = parseBlock(agent.prompt);
      const mine = AGENT_LENSES[agent.id];
      const key = (rule: { lens: AgentId; intensity: LensIntensity | null }) => `${rule.lens}:${rule.intensity}`;
      assert.deepEqual(parsed.allowed.map(key).sort(), mine.allowed.map(key).sort(), `${agent.id} permitidas`);
      assert.deepEqual([...parsed.forbidden].sort(), [...mine.forbidden].sort(), `${agent.id} proibidas`);
    }
  });
});
