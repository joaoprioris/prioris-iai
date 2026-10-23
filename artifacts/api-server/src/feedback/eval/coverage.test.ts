import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOMENTOS } from "../moments.ts";
import { COVERAGE, currentMoments, report, scenarioIds, withProposals } from "./coverage.ts";
import { PROPOSED_SCENARIOS } from "./proposed-scenarios.ts";
import { SCENARIOS } from "./scenarios.ts";

describe("cobertura dos cenários sobre a biblioteca de 80 momentos", () => {
  it("o mapeamento cobre exatamente os cenários existentes e só cita momentos que existem", () => {
    assert.deepEqual(COVERAGE.map((entry) => entry.cenario).sort(), scenarioIds().sort());
    for (const entry of COVERAGE)
      for (const id of [...entry.exatos, ...entry.aproximados]) assert.ok(MOMENTOS[id - 1], `${entry.cenario}: ${id}`);
  });

  it("estado atual: 8 momentos exatos, 7 de 12 células (custo x fase) e 6 de 10 dívidas", () => {
    const now = report(currentMoments());
    assert.equal(currentMoments().length, 8);
    assert.equal(now.cells.size, 7);
    assert.equal(now.debts.size, 6);
    assert.deepEqual(now.missingCells.sort(), [
      "cinismo/Antes",
      "cinismo/Durante",
      "paralisia/Durante",
      "retrabalho/Durante",
      "ruptura/Depois",
    ]);
    assert.deepEqual(now.missingDebts.sort(), [
      "accountability_diluida",
      "alinhamento_simbolico",
      "confianca_erosionada",
      "maturidade_politica_insuficiente",
    ]);
  });

  it("com os 5 cenários propostos: 12 de 12 células e 10 de 10 dívidas", () => {
    const next = report(withProposals());
    assert.deepEqual(next.missingCells, []);
    assert.deepEqual(next.missingDebts, []);
  });

  it("cenários propostos têm ids próprios, estado coerente com a fase do momento e não entram em SCENARIOS", () => {
    const existing = new Set(SCENARIOS.map((scenario) => scenario.id));
    for (const proposed of PROPOSED_SCENARIOS) {
      assert.ok(!existing.has(proposed.id), proposed.id);
      assert.equal(proposed.estado, MOMENTOS[proposed.momento - 1].fase, proposed.id);
    }
    assert.equal(new Set(PROPOSED_SCENARIOS.map((s) => s.id)).size, PROPOSED_SCENARIOS.length);
  });
});
