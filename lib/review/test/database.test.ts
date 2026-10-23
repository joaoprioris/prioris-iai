import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { authenticate, drain, handleIngress, InMemoryQueue, persist, EventConflict } from "../src/index.ts";
import type { Envelope } from "../src/index.ts";
import { hasServer, startDatabase, type TestDatabase } from "./pg-harness.ts";
import { iso, monthStart, resolveKey, sedPayload, signedRequest, surveyPayload, token } from "./fixtures.ts";

let db: TestDatabase | null = null;
const closedMonth = monthStart(-2);
const openMonth = monthStart(0);
const inClosed = (day = 5) => new Date(Date.UTC(closedMonth.getUTCFullYear(), closedMonth.getUTCMonth(), day, 12));
const date = (value: Date) => value.toISOString().slice(0, 10);

function envelope(payload: Record<string, unknown>, tenant = "cli_a"): Envelope {
  const { raw, headers } = signedRequest(payload, tenant === "cli_a" ? {} : { keyId: "key_b", secret: Buffer.alloc(32, 9) });
  return authenticate(raw, headers, resolveKey);
}

const ingest = () => db!.client("review_ingest");
const connect = () => ingest();

async function superuser<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = await db!.client("postgres");
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

const count = (table: string, tenant?: string) =>
  superuser(async (c) => Number((await c.query(`SELECT count(*) FROM prioris_review.${table}${tenant ? ` WHERE client_id='${tenant}'` : ""}`)).rows[0].count));

async function release(tenant: string, fn: "sed_release" | "survey_release") {
  const client = await db!.client("review_report");
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant', $1, true)", [tenant]);
    const result = await client.query(`SELECT * FROM prioris_review.${fn}()`);
    await client.query("COMMIT");
    return result.rows;
  } finally {
    await client.end();
  }
}

async function closeCycle(tenant: string, cycle: Date) {
  const client = await db!.client("review_admin");
  try {
    await client.query("SELECT prioris_review.close_cycle($1, $2)", [tenant, date(cycle)]);
  } finally {
    await client.end();
  }
}

before(async () => {
  db = await startDatabase();
  if (!db) return;
  await superuser(async (c) => {
    await c.query("INSERT INTO prioris_review.clients VALUES ('cli_a'),('cli_b')");
    await c.query("INSERT INTO prioris_review.groups VALUES ('cli_a',1,'Engenharia'),('cli_a',2,'Comercial'),('cli_b',1,'Operações')");
    for (const tenant of ["cli_a", "cli_b"])
      for (const month of [closedMonth, openMonth])
        await c.query("INSERT INTO prioris_review.cycles(client_id,cycle_start) VALUES ($1,$2)", [tenant, date(month)]);
  });
});

after(() => db?.stop());

const skip = () => (hasServer() ? false : "PostgreSQL de servidor não encontrado");

describe("persistência", { skip: skip() }, () => {
  it("grava SED e resposta da pesquisa e reconhece reentrega idêntica", async () => {
    const sed = envelope(sedPayload({ event_id: "p1" }, inClosed()));
    assert.equal(await persist(sed, connect), "inserted");
    assert.equal(await persist(sed, connect), "duplicate");
    const survey = envelope(surveyPayload({ event_id: "p2" }, inClosed()));
    assert.equal(await persist(survey, connect), "inserted");
    assert.equal(await count("sed_events", "cli_a"), 1);
    assert.equal(await count("survey_answers", "cli_a"), 1);
  });

  it("mesmo event_id com bytes diferentes é conflito e não altera o registro", async () => {
    const other = envelope(sedPayload({ event_id: "p1", intensity_proxy: "Alta" }, inClosed()));
    await assert.rejects(persist(other, connect), EventConflict);
    const rows = await superuser((c) => c.query("SELECT intensity_proxy FROM prioris_review.sed_events WHERE event_id='p1'"));
    assert.equal(rows.rows[0].intensity_proxy, "Media");
  });

  it("evento concorrente idêntico grava uma vez só", async () => {
    const same = envelope(sedPayload({ event_id: "race" }, inClosed(6)));
    const results = await Promise.all(Array.from({ length: 12 }, () => persist(same, connect)));
    assert.equal(results.filter((r) => r === "inserted").length, 1);
    assert.equal(results.filter((r) => r === "duplicate").length, 11);
  });

  it("grupo de outro cliente não existe para o cliente autenticado", async () => {
    const stray = envelope(sedPayload({ event_id: "x1", client_id: "cli_b", group_id: 2 }, inClosed()), "cli_b");
    await assert.rejects(persist(stray, connect), (e: { code?: string }) => e.code === "23503");
    assert.equal(await count("sed_events", "cli_b"), 0);
  });

  it("o papel de ingestão só enxerga o próprio cliente", async () => {
    await persist(envelope(sedPayload({ event_id: "b1", client_id: "cli_b", group_id: 1 }, inClosed()), "cli_b"), connect);
    const client = await ingest();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant','cli_b',true)");
      const seen = await client.query("SELECT DISTINCT client_id FROM prioris_review.sed_events");
      assert.deepEqual(seen.rows.map((r) => r.client_id), ["cli_b"]);
      await client.query("ROLLBACK");
      const none = await client.query("SELECT count(*) FROM prioris_review.sed_events");
      assert.equal(Number(none.rows[0].count), 0);
    } finally {
      await client.end();
    }
  });

  it("papéis têm privilégio mínimo", async () => {
    const worker = await ingest();
    await assert.rejects(worker.query("UPDATE prioris_review.sed_events SET context='crise'"), (e: { code?: string }) => e.code === "42501");
    await assert.rejects(worker.query("DELETE FROM prioris_review.sed_events"), (e: { code?: string }) => e.code === "42501");
    await assert.rejects(worker.query("UPDATE prioris_review.cycles SET closed=true"), (e: { code?: string }) => e.code === "42501");
    await worker.end();
    const report = await db!.client("review_report");
    await assert.rejects(report.query("SELECT * FROM prioris_review.sed_events"), (e: { code?: string }) => e.code === "42501");
    await assert.rejects(report.query("SELECT * FROM prioris_review.survey_answers"), (e: { code?: string }) => e.code === "42501");
    await report.end();
  });

  it("restrições do esquema rejeitam dados fora do contrato mesmo sem passar pela validação", async () => {
    const c = await superuser(async (s) => {
      await assert.rejects(s.query("INSERT INTO prioris_review.survey_answers VALUES ('cli_a','z',repeat('a',64),1,repeat('b',64),now(),$1,'evitacao_conflito.1',9)", [date(openMonth)]), (e: { code?: string }) => e.code === "23514");
      return true;
    });
    assert.ok(c);
  });
});

describe("catálogo, perguntas e habilitação por contrato", { skip: skip() }, () => {
  it("o catálogo tem 10 dívidas e 30 perguntas, e o banco rejeita pergunta ou dívida inexistente", async () => {
    assert.equal(await count("debts"), 10);
    assert.equal(await count("questions"), 30);
    await superuser(async (s) => {
      await assert.rejects(s.query("INSERT INTO prioris_review.survey_answers VALUES ('cli_a','q1',repeat('a',64),1,repeat('b',64),now(),$1,'evitacao_conflito.4',2)", [date(openMonth)]), (e: { code?: string }) => e.code === "23503" || e.code === "23514");
      await assert.rejects(s.query("INSERT INTO prioris_review.sed_events VALUES ('cli_a','q2',repeat('a',64),1,repeat('b',64),now(),$1,'inexistente',NULL,'feedback','time','Antes','Baixa')", [date(openMonth)]), (e: { code?: string }) => e.code === "23503");
    });
  });

  it("habilitação: contrato de 6 ou 12 meses, e alerta exige o módulo visível ao cliente", async () => {
    const admin = await db!.client("review_admin");
    try {
      await admin.query("INSERT INTO prioris_review.client_entitlements VALUES ('cli_a', 12, true, true)");
      await assert.rejects(admin.query("INSERT INTO prioris_review.client_entitlements VALUES ('cli_b', 6, false, true)"), (e: { code?: string }) => e.code === "23514");
      await assert.rejects(admin.query("INSERT INTO prioris_review.client_entitlements VALUES ('cli_b', 9, false, false)"), (e: { code?: string }) => e.code === "23514");
      await admin.query("INSERT INTO prioris_review.client_entitlements VALUES ('cli_b', 6, false, false)");
    } finally {
      await admin.end();
    }
    const worker = await ingest();
    await assert.rejects(worker.query("SELECT * FROM prioris_review.client_entitlements"), (e: { code?: string }) => e.code === "42501");
    await worker.end();
  });
});

describe("ciclos e publicação", { skip: skip() }, () => {
  it("nada é publicado antes do encerramento do ciclo", async () => {
    for (const n of [1, 2, 3]) await persist(envelope(sedPayload({ event_id: `r${n}`, contributor_token: token(n), group_id: 2, debt_principal: "decisao_postergada" }, inClosed(8))), connect);
    assert.deepEqual(await release("cli_a", "sed_release"), []);
  });

  it("ciclo da janela atual não pode ser encerrado, e ciclo inexistente também não", async () => {
    await assert.rejects(closeCycle("cli_a", openMonth), /window not finished/);
    await assert.rejects(closeCycle("cli_a", monthStart(-30)), /unknown cycle/);
  });

  it("amostra com menos de 3 participantes distintos é suprimida, mesmo com muitos eventos", async () => {
    for (let i = 0; i < 5; i++) await persist(envelope(sedPayload({ event_id: `s${i}`, contributor_token: token(i % 2 + 10), group_id: 1, debt_principal: "accountability_diluida" }, inClosed(9))), connect);
    await persist(envelope(surveyPayload({ event_id: "sv1", contributor_token: token(1), group_id: 2, question_id: "decisao_postergada.1", answer: 4 }, inClosed(9))), connect);
    await persist(envelope(surveyPayload({ event_id: "sv2", contributor_token: token(2), group_id: 2, question_id: "decisao_postergada.1", answer: 2 }, inClosed(9))), connect);
    await closeCycle("cli_a", closedMonth);
    const rows = await release("cli_a", "sed_release");
    assert.ok(!rows.some((r) => r.group_id === 1 && r.debt_principal === "accountability_diluida"));
    assert.deepEqual(await release("cli_a", "survey_release"), []);
  });

  it("publica com 3 participantes distintos e conta cada evento", async () => {
    const rows = await release("cli_a", "sed_release");
    const row = rows.find((r) => r.group_id === 2 && r.debt_principal === "decisao_postergada" && r.momento === "Antes");
    assert.ok(row);
    assert.equal(Number(row.events), 3);
    assert.equal(Number(row.medium), 3);
    assert.equal(rows.every((r) => r.cycle_start instanceof Date || typeof r.cycle_start === "object"), true);
  });

  it("adjacência: publicada só ao motor, com a mesma supressão, e nunca sem adjacente", async () => {
    const client = await db!.client("review_report");
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant', $1, true)", ["cli_a"]);
      const rows = (await client.query("SELECT * FROM prioris_review.adjacency_release()")).rows;
      await client.query("COMMIT");
      const row = rows.find((r) => r.group_id === 2 && r.debt_principal === "decisao_postergada" && r.debt_adjacent === "comunicacao_ambigua");
      assert.ok(row);
      assert.ok(Number(row.events) >= 3);
      assert.ok(!rows.some((r) => r.group_id === 1 && r.debt_principal === "accountability_diluida"));
      assert.ok(rows.every((r) => r.debt_adjacent !== null));
    } finally {
      await client.end();
    }
    const worker = await ingest();
    await assert.rejects(worker.query("SELECT * FROM prioris_review.adjacency_release()"), (e: { code?: string }) => e.code === "42501");
    await worker.end();
  });

  it("resposta da pesquisa publica a média por participante só com 3 respondentes", async () => {
    await superuser((c) => c.query("UPDATE prioris_review.cycles SET closed=false WHERE client_id='cli_a' AND cycle_start=$1", [date(closedMonth)]));
    await persist(envelope(surveyPayload({ event_id: "sv3", contributor_token: token(3), group_id: 2, question_id: "decisao_postergada.1", answer: 3 }, inClosed(10))), connect);
    await persist(envelope(surveyPayload({ event_id: "sv4", contributor_token: token(3), group_id: 2, question_id: "decisao_postergada.1", answer: 1 }, inClosed(10))), connect);
    await closeCycle("cli_a", closedMonth);
    const rows = await release("cli_a", "survey_release");
    assert.equal(rows.length, 1);
    // participantes: 4 e 2 e média(3,1)=2 -> média das médias = 2.666...
    assert.ok(Math.abs(Number(rows[0].mean_answer) - (4 + 2 + 2) / 3) < 1e-9);
  });

  it("agregados não vazam entre clientes", async () => {
    const other = await release("cli_b", "sed_release");
    assert.ok(other.every((r) => r.group_id === 1));
    assert.equal(other.length, 0);
  });

  it("evento novo em ciclo encerrado é recusado, mas reentrega de evento conhecido é reconhecida", async () => {
    const late = envelope(sedPayload({ event_id: "late" }, inClosed(20)));
    await assert.rejects(persist(late, connect), (e: { code?: string }) => e.code === "23514");
    const known = envelope(sedPayload({ event_id: "p1" }, inClosed()));
    assert.equal(await persist(known, connect), "duplicate");
  });
});

describe("fluxo completo: ingresso, fila, persistência", { skip: skip() }, () => {
  it("assinatura inválida não chega à fila; válida é persistida; falha transitória é repetida; ciclo encerrado vai para quarentena", async () => {
    const queue = new InMemoryQueue();
    const deps = { resolveKey, publish: (e: Envelope) => queue.publish(e) };
    const good = signedRequest(sedPayload({ event_id: "flow1", group_id: 2 }, new Date(Date.now() - 60_000)));
    const forged = signedRequest(sedPayload({ event_id: "flow2" }), { secret: Buffer.alloc(32, 1) });
    assert.equal((await handleIngress({ headers: forged.headers, body: forged.raw }, deps)).statusCode, 401);
    assert.equal((await handleIngress({ headers: good.headers, body: good.raw }, deps)).statusCode, 202);
    assert.equal(queue.pending.length, 1);

    let attempts = 0;
    const flaky = async () => { if (++attempts === 1) throw new Error("connection reset"); return connect(); };
    const summary = await drain(queue, (e) => persist(e, flaky));
    assert.deepEqual(summary, { inserted: 1, duplicate: 0, quarantined: 0, retried: 1 });

    await queue.publish(envelope(sedPayload({ event_id: "flow-late" }, inClosed(21))));
    const late = await drain(queue, (e) => persist(e, connect));
    assert.equal(late.quarantined, 1);
    assert.equal(queue.deadLetter[0].reason, "permanent");
    void iso;
  });
});
