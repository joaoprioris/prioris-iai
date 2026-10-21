import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countExchanges,
  MAX_USER_MESSAGE_CHARS,
  runTurn,
  type ChatMessage,
  type FeedbackProvider,
} from "./conversation.ts";
import { CLOSING_PHRASE, FEEDBACK_GUIDANCE, MAX_EXCHANGES } from "./guidance.ts";

function fakeProvider(reply: string | Error) {
  const calls: { system: string; messages: ChatMessage[] }[] = [];
  const provider: FeedbackProvider = {
    async complete(input) {
      calls.push(input);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { provider, calls };
}

function historyWith(exchanges: number): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (let i = 1; i <= exchanges; i++) {
    history.push({ role: "user", content: `fala ${i}` }, { role: "assistant", content: `resposta ${i}` });
  }
  return history;
}

describe("orientação do agente de Feedback", () => {
  it("traz a frase de saída, o limite de trocas e os quatro blocos da resposta", () => {
    assert.ok(FEEDBACK_GUIDANCE.includes(CLOSING_PHRASE));
    assert.ok(FEEDBACK_GUIDANCE.includes(`${MAX_EXCHANGES} trocas`));
    for (const block of ["Leitura do momento", "Tensão central", "Direcionamento prático"]) {
      assert.ok(FEEDBACK_GUIDANCE.includes(block), block);
    }
  });

  it("não usa as palavras vetadas em texto de produto", () => {
    assert.doesNotMatch(FEEDBACK_GUIDANCE, /terap/i);
  });
});

describe("runTurn", () => {
  it("envia a orientação, o histórico e a fala do líder, e devolve a resposta", async () => {
    const { provider, calls } = fakeProvider("  Entendi a dificuldade.  ");
    const history = historyWith(1);
    const result = await runTurn(provider, history, "  preciso cobrar uma pessoa  ");

    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.reply, "Entendi a dificuldade.");
    assert.equal(result.exchange, 2);
    assert.equal(result.closed, false);
    assert.equal(calls[0].system, FEEDBACK_GUIDANCE);
    assert.deepEqual(calls[0].messages.at(-1), { role: "user", content: "preciso cobrar uma pessoa" });
    assert.equal(calls[0].messages.length, 3);
    assert.equal(countExchanges(result.history), 2);
    assert.equal(history.length, 2);
  });

  it("encerra antes do limite quando o agente fecha com a frase de saída", async () => {
    const reply = `Já dá para seguir.\n\n${CLOSING_PHRASE}`;
    const { provider } = fakeProvider(reply);
    const result = await runTurn(provider, historyWith(3), "ok, vou falar com ela");

    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.closed, true);
    assert.equal(result.exchange, 4);

    const { provider: other, calls } = fakeProvider("não deveria chamar");
    assert.deepEqual(await runTurn(other, result.history, "mais uma coisa"), { status: "closed" });
    assert.equal(calls.length, 0);
  });

  it("na décima troca instrui o fechamento e garante a frase de saída", async () => {
    const { provider, calls } = fakeProvider("Última ajuda concreta.");
    const result = await runTurn(provider, historyWith(MAX_EXCHANGES - 1), "e se ela reagir mal?");

    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.exchange, MAX_EXCHANGES);
    assert.equal(result.closed, true);
    assert.ok(result.reply.endsWith(CLOSING_PHRASE));
    assert.ok(calls[0].system.includes("última troca"));

    const next = await runTurn(provider, result.history, "mais uma");
    assert.deepEqual(next, { status: "closed" });
  });

  it("não duplica a frase de saída quando o agente já a usou na décima troca", async () => {
    const { provider } = fakeProvider(`Pronto.\n\n${CLOSING_PHRASE}`);
    const result = await runTurn(provider, historyWith(MAX_EXCHANGES - 1), "fecha");
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.reply.split(CLOSING_PHRASE).length, 2);
  });

  it("falha do provider não consome troca nem altera o histórico", async () => {
    const history = historyWith(2);
    for (const reply of [new Error("fora do ar"), "   "]) {
      const { provider } = fakeProvider(reply);
      assert.deepEqual(await runTurn(provider, history, "oi"), { status: "error" });
    }
    assert.equal(countExchanges(history), 2);
  });

  it("rejeita fala vazia ou longa demais sem chamar o provider", async () => {
    const { provider, calls } = fakeProvider("x");
    assert.deepEqual(await runTurn(provider, [], "   "), { status: "invalid", reason: "empty" });
    assert.deepEqual(await runTurn(provider, [], "a".repeat(MAX_USER_MESSAGE_CHARS + 1)), {
      status: "invalid",
      reason: "too_long",
    });
    assert.equal(calls.length, 0);
  });
});
