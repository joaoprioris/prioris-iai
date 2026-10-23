import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CUSTO_DA_DIVIDA, MOMENTOS, TOP10, momentoPorId } from "./moments.ts";

describe("biblioteca de momentos do Feedback", () => {
  it("tem 80 momentos, 20 por custo, em ids de 1 a 80", () => {
    assert.equal(MOMENTOS.length, 80);
    assert.deepEqual(
      MOMENTOS.map((m) => m.id),
      Array.from({ length: 80 }, (_, i) => i + 1),
    );
    for (const custo of ["paralisia", "retrabalho", "cinismo", "ruptura"])
      assert.equal(MOMENTOS.filter((m) => m.custo === custo).length, 20, custo);
  });

  it("cada dívida tem a contagem do documento", () => {
    const esperado = {
      evitacao_conflito: 10,
      decisao_postergada: 10,
      comunicacao_ambigua: 7,
      autoridade_fragilizada: 7,
      accountability_diluida: 6,
      confianca_erosionada: 7,
      aprendizado_bloqueado: 6,
      alinhamento_simbolico: 7,
      energia_emocional_degradada: 10,
      maturidade_politica_insuficiente: 10,
    };
    assert.deepEqual(Object.keys(CUSTO_DA_DIVIDA).sort(), Object.keys(esperado).sort());
    for (const [divida, total] of Object.entries(esperado))
      assert.equal(MOMENTOS.filter((m) => m.divida === divida).length, total, divida);
  });

  it("textos únicos, fases válidas e Top 10 aponta para momentos existentes", () => {
    assert.equal(new Set(MOMENTOS.map((m) => m.texto)).size, 80);
    assert.ok(MOMENTOS.every((m) => ["Antes", "Durante", "Depois"].includes(m.fase)));
    assert.equal(TOP10.length, 10);
    assert.match(momentoPorId(8)!.texto, /boa conversa/);
    assert.match(momentoPorId(80)!.texto, /marcado como difícil/);
  });
});
