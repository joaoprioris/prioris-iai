import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authenticate, handleIngress, validateEvent, InMemoryQueue, drain, Rejected, EventConflict } from "../src/index.ts";
import {
  alertFor, dco, dcoMultiplier, DEFAULT_PARAMS, iecSeries, isReportable, maturity, top3, zone,
} from "../src/index.ts";
import { resolveKey, sedPayload, signedRequest, surveyPayload, token, SECRET_B } from "./fixtures.ts";

const now = () => Date.now() / 1000;

describe("autenticação", () => {
  it("aceita assinatura válida e devolve o digest dos bytes originais", () => {
    const { raw, headers } = signedRequest(sedPayload());
    const envelope = authenticate(raw, headers, resolveKey);
    assert.equal(envelope.tenant, "cli_a");
    assert.equal(envelope.event.kind, "sed");
    assert.match(envelope.digest, /^[0-9a-f]{64}$/);
  });

  it("rejeita assinatura de outro cliente, chave desconhecida e entrega antiga", () => {
    const wrong = signedRequest(sedPayload(), { secret: SECRET_B });
    assert.throws(() => authenticate(wrong.raw, wrong.headers, resolveKey), (e: Rejected) => e.status === 401);
    const unknown = signedRequest(sedPayload(), { keyId: "key_x" });
    assert.throws(() => authenticate(unknown.raw, unknown.headers, resolveKey), (e: Rejected) => e.status === 401);
    const stale = signedRequest(sedPayload(), { sentAt: Math.floor(now()) - 301 });
    assert.throws(() => authenticate(stale.raw, stale.headers, resolveKey), (e: Rejected) => e.status === 401);
  });

  it("não reserializa: alterar um byte invalida a assinatura", () => {
    const { raw, headers } = signedRequest(sedPayload());
    const tampered = Buffer.concat([raw, Buffer.from(" ")]);
    assert.throws(() => authenticate(tampered, headers, resolveKey), (e: Rejected) => e.status === 401);
  });

  it("rejeita cabeçalho duplicado, corpo grande, JSON inválido e chave JSON duplicada", () => {
    const { raw, headers } = signedRequest(sedPayload());
    assert.throws(() => authenticate(raw, { ...headers, "X-Prioris-Key-Id": "key_a" }, resolveKey), Rejected);
    const big = signedRequest(null, { raw: Buffer.alloc(16385, 65) });
    assert.throws(() => authenticate(big.raw, big.headers, resolveKey), Rejected);
    const bad = signedRequest(null, { raw: Buffer.from("{nope") });
    assert.throws(() => authenticate(bad.raw, bad.headers, resolveKey), (e: Rejected) => e.status === 400);
    const text = JSON.stringify(sedPayload()).replace('"actor":"liderado"', '"actor":"liderado","actor":"chefe"');
    const dup = signedRequest(null, { raw: Buffer.from(text) });
    assert.throws(() => authenticate(dup.raw, dup.headers, resolveKey), /duplicate JSON key/);
  });
});

describe("validação do contrato", () => {
  const t = now();
  it("aceita SED e resposta da pesquisa", () => {
    assert.equal(validateEvent(sedPayload(), "cli_a", t).kind, "sed");
    assert.equal(validateEvent(surveyPayload(), "cli_a", t).kind, "survey");
    assert.equal(validateEvent(sedPayload({ debt_adjacent: null }), "cli_a", t).kind, "sed");
  });

  it("rejeita campo extra, falta de campo, versão, cliente e tipo", () => {
    assert.throws(() => validateEvent({ ...sedPayload(), extra: 1 }, "cli_a", t), Rejected);
    const { actor: _actor, ...missing } = sedPayload();
    assert.throws(() => validateEvent(missing, "cli_a", t), Rejected);
    assert.throws(() => validateEvent(sedPayload({ schema_version: 2 }), "cli_a", t), Rejected);
    assert.throws(() => validateEvent(sedPayload({ client_id: "cli_b" }), "cli_a", t), /tenant mismatch/);
    assert.throws(() => validateEvent(sedPayload({ kind: "x" }), "cli_a", t), Rejected);
  });

  it("rejeita enumerações, dívidas e adjacente igual à principal", () => {
    for (const bad of [
      { context: "reestruturacao" }, { actor: "x" }, { momento: "Agora" }, { intensity_proxy: "Alta " },
      { debt_principal: 0 }, { debt_principal: 11 }, { debt_adjacent: 1 }, { debt_adjacent: 1.5 },
      { group_id: "1" }, { contributor_token: "ABC" }, { event_id: "" },
    ])
      assert.throws(() => validateEvent(sedPayload(bad), "cli_a", t), Rejected, JSON.stringify(bad));
  });

  it("rejeita resposta fora da escala, pergunta inexistente e timestamp inválido ou futuro", () => {
    for (const bad of [{ answer: 5 }, { answer: -1 }, { answer: 2.5 }, { question_id: "I1" }, { question_id: "A7" }])
      assert.throws(() => validateEvent(surveyPayload(bad), "cli_a", t), Rejected, JSON.stringify(bad));
    assert.throws(() => validateEvent(sedPayload({ timestamp: "2026-10-07 15:30:00" }), "cli_a", t), /timestamp/);
    assert.throws(() => validateEvent(sedPayload({ timestamp: "2026-10-07T15:30:00" }), "cli_a", t), /timestamp/);
    assert.throws(() => validateEvent(sedPayload({ timestamp: new Date(Date.now() + 3_600_000).toISOString() }), "cli_a", t), /future/);
  });
});

describe("ingresso", () => {
  it("responde 202 só depois de publicar e não publica requisição inválida", async () => {
    const published: unknown[] = [];
    const { raw, headers } = signedRequest(sedPayload());
    const ok = await handleIngress({ headers, body: raw }, { resolveKey, publish: async (e) => void published.push(e) });
    assert.equal(ok.statusCode, 202);
    assert.equal(published.length, 1);
    const bad = signedRequest(sedPayload(), { secret: SECRET_B });
    const denied = await handleIngress({ headers: bad.headers, body: bad.raw }, { resolveKey, publish: async (e) => void published.push(e) });
    assert.equal(denied.statusCode, 401);
    assert.equal(published.length, 1);
  });

  it("falha da fila vira 503 genérico e suporta corpo base64", async () => {
    const { raw, headers } = signedRequest(sedPayload());
    const down = await handleIngress({ headers, body: raw.toString("base64"), isBase64Encoded: true }, {
      resolveKey, publish: async () => { throw new Error("queue down"); },
    });
    assert.equal(down.statusCode, 503);
    assert.doesNotMatch(down.body, /queue/);
    const malformed = await handleIngress({ headers, body: "***", isBase64Encoded: true }, { resolveKey, publish: async () => undefined });
    assert.equal(malformed.statusCode, 400);
  });
});

describe("fila", () => {
  it("repete erro transitório, põe erro permanente em quarentena e esgota tentativas na DLQ", async () => {
    const queue = new InMemoryQueue();
    const { raw, headers } = signedRequest(sedPayload());
    const envelope = authenticate(raw, headers, resolveKey);
    await queue.publish(envelope);
    let calls = 0;
    const flaky = await drain(queue, async () => { if (++calls < 3) throw new Error("db down"); return "inserted"; });
    assert.deepEqual(flaky, { inserted: 1, duplicate: 0, quarantined: 0, retried: 2 });

    await queue.publish(envelope);
    const permanent = await drain(queue, async () => { throw new EventConflict("x"); });
    assert.equal(permanent.quarantined, 1);
    assert.equal(permanent.retried, 0);

    await queue.publish(envelope);
    const exhausted = await drain(queue, async () => { throw new Error("db down"); }, 2);
    assert.equal(exhausted.quarantined, 1);
    assert.equal(queue.deadLetter.length, 2);
    void token;
  });
});

describe("motor IEC: regressão do ensaio de 11/10/2026", () => {
  const round = (values: number[]) => values.map((value) => Math.round(value * 100) / 100);

  it("cenário 1, instalação crônica", () => {
    const series = iecSeries({
      frequency: [2, 3, 5, 8, 12, 14, 15, 14, 16, 15, 15, 16], intensity: 0.75, areas: 4,
      adjacentSum: [0.2, 0.4, 0.6, 1.2, 1.8, 2.2, 2.4, 2.5, 2.6, 2.6, 2.7, 2.8],
    });
    assert.deepEqual(round(series), [48.75, 51.75, 56.85, 68.22, 84.08, 94.03, 99.28, 97.21, 100, 100, 100, 100]);
  });

  it("cenário 2, crise aguda com recessão", () => {
    const series = iecSeries({
      frequency: [12, 14, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0], intensity: 0.85, areas: 2,
      adjacentSum: [0.8, 1.2, 0.3, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    assert.deepEqual(round(series), [71.07, 80.18, 43.01, 37.43, 33.3, 30.74, 28.38, 26.2, 24.18, 22.32, 20.61, 19.02]);
  });

  it("parâmetros são injetáveis", () => {
    const base = { frequency: [10], intensity: 0.5, areas: 2, adjacentSum: [0] };
    assert.notEqual(iecSeries(base)[0], iecSeries(base, { ...DEFAULT_PARAMS, alpha: 1 })[0]);
  });
});

describe("zonas, DCO, top 3, alertas e maturidade", () => {
  it("zonas e multiplicadores nas bordas", () => {
    assert.deepEqual([39.99, 40, 69.99, 70].map(zone), ["Verde", "Amarela", "Amarela", "Vermelha"]);
    assert.deepEqual([10, 40, 70, 84.99, 85, 100].map(dcoMultiplier), [0.7, 1.0, 1.4, 1.4, 1.8, 1.8]);
  });

  it("reproduz as linhas do demonstrativo do Dossiê", () => {
    const round = (value: number) => Math.round(value * 100) / 100;
    assert.equal(round(dco({ R: 52, T: 3.5, P: 6, C: 140, iec: 88.5 })), 275184);
    assert.equal(round(dco({ R: 24, T: 8, P: 4, C: 160, iec: 74.2 })), 172032);
    assert.equal(round(dco({ R: 12, T: 12, P: 14, C: 120, iec: 91.1 })), 435456);
  });

  it("limita a 3 dívidas em vermelho e desempata por IEC x peso político", () => {
    const debts = [
      { debtId: 1, iec: 90 }, { debtId: 2, iec: 80 }, { debtId: 3, iec: 75, weight: 1.5 },
      { debtId: 4, iec: 72 }, { debtId: 5, iec: 50 },
    ];
    assert.deepEqual(top3(debts).map((d) => d.debtId), [3, 1, 2]);
    assert.deepEqual(top3([{ debtId: 5, iec: 50 }]), []);
  });

  it("alerta só após 3 ciclos e 2 ciclos consecutivos na mesma zona", () => {
    assert.equal(alertFor(["Vermelha", "Vermelha"]), null);
    assert.equal(alertFor(["Verde", "Vermelha", "Vermelha"]), "vermelho");
    assert.equal(alertFor(["Verde", "Amarela", "Amarela"]), "amarelo");
    assert.equal(alertFor(["Amarela", "Amarela", "Vermelha"]), null);
    assert.equal(alertFor(["Vermelha", "Vermelha", "Verde"]), null);
  });

  it("maturidade é o menor dos três vetores e abaixo de N2 não há relatório", () => {
    assert.equal(maturity({ eventsPerMonth: 700, leaders: 200, activeLeaderShare: 0.6, stableMonths: 7 }), 2);
    assert.equal(maturity({ eventsPerMonth: 1000, leaders: 200, activeLeaderShare: 0.6, stableMonths: 7 }), 3);
    assert.equal(maturity({ eventsPerMonth: 1900, leaders: 200, activeLeaderShare: 0.6, stableMonths: 7 }), 4);
    assert.equal(maturity({ eventsPerMonth: 1900, leaders: 200, activeLeaderShare: 0.6, stableMonths: 4 }), 3);
    assert.equal(maturity({ eventsPerMonth: 1900, leaders: 200, activeLeaderShare: 0.1, stableMonths: 7 }), 0);
    assert.equal(maturity({ eventsPerMonth: 19, leaders: 8, activeLeaderShare: 0.5, stableMonths: 3 }), 0);
    assert.equal(isReportable(1), false);
    assert.equal(isReportable(2), true);
  });
});
