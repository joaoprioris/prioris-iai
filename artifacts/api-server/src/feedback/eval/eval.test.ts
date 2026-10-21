import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOSING_PHRASE } from "../guidance.ts";
import type { ChatMessage, FeedbackProvider } from "../conversation.ts";
import { BudgetExceeded, BudgetGuard, costUsd, guardClient } from "./budget.ts";
import { accept, deterministicChecks, parseVerdict } from "./judge.ts";
import { runConversation, type Deps } from "./run-eval.ts";
import { SCENARIOS } from "./scenarios.ts";
import { leaderView, parseRating } from "./simulated-leader.ts";

describe("cenários", () => {
  it("cobrem os cinco estados e têm ids únicos", () => {
    const estados = new Set(SCENARIOS.map((scenario) => scenario.estado));
    assert.deepEqual([...estados].sort(), ["Antes", "Depois", "Durante", "Padrão", "Vazio"]);
    assert.equal(new Set(SCENARIOS.map((scenario) => scenario.id)).size, SCENARIOS.length);
  });
});

describe("orçamento", () => {
  it("calcula o custo pelo preço de lista do modelo", () => {
    assert.equal(costUsd("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 100_000 }), 3);
  });

  it("recusa a chamada que estouraria o teto, sem chamar a API", async () => {
    let calls = 0;
    const real = {
      messages: {
        create: async (_body: never) => {
          calls += 1;
          return { usage: { input_tokens: 1000, output_tokens: 100 } };
        },
      },
    };
    const guard = new BudgetGuard(0.001);
    const client = guardClient(real, guard);
    await assert.rejects(
      () => client.messages.create({ model: "claude-opus-5-5", max_tokens: 4000, messages: [] } as never),
      BudgetExceeded,
    );
    assert.equal(calls, 0);
  });

  it("registra o uso real depois da chamada", async () => {
    const real = { messages: { create: async (_body: never) => ({ usage: { input_tokens: 2000, output_tokens: 500 } }) } };
    const guard = new BudgetGuard(5);
    await guardClient(real, guard).messages.create({ model: "claude-haiku-5-5", max_tokens: 100, messages: [] } as never);
    assert.equal(guard.calls, 1);
    assert.ok(guard.spentUsd > 0 && guard.spentUsd < 0.001);
  });
});

describe("líder simulado", () => {
  it("inverte os papéis e começa com uma mensagem do lado do IAí", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "abertura do líder" },
      { role: "assistant", content: "resposta do IAí" },
    ];
    const view = leaderView(history);
    assert.equal(view[0].role, "user");
    assert.deepEqual(view.slice(1).map((m) => m.role), ["assistant", "user"]);
  });

  it("rejeita nota fora de 1 a 5", () => {
    assert.throws(() => parseRating('{"nota": 7, "comentario": "x", "usaria_de_novo": true}'));
    assert.equal(parseRating('{"nota": 4, "comentario": "ok", "usaria_de_novo": true}').nota, 4);
  });
});

describe("avaliação", () => {
  it("rejeita código de problema desconhecido", () => {
    assert.throws(() => parseVerdict('{"utilidade": 4, "problemas": [{"codigo": "outro", "gravidade": "grave", "trecho": "x"}], "observacao": ""}'));
  });

  it("verificações fixas pegam termo vetado, falta da frase de saída e frase antecipada", () => {
    const good: ChatMessage[] = [
      { role: "user", content: "oi" },
      { role: "assistant", content: `Certo.\n\n${CLOSING_PHRASE}` },
    ];
    assert.deepEqual(deterministicChecks(good), []);
    const bad: ChatMessage[] = [
      { role: "user", content: "oi" },
      { role: "assistant", content: `Isso é uma dívida cultural. ${CLOSING_PHRASE}` },
      { role: "user", content: "e agora" },
      { role: "assistant", content: "sem frase" },
    ];
    const failures = deterministicChecks(bad);
    assert.ok(failures.some((f) => f.includes("termo vetado")));
    assert.ok(failures.some((f) => f.includes("não encerrou")));
    assert.ok(failures.some((f) => f.includes("antes do encerramento")));
  });

  it("só aceita com nota alta, utilidade alta e nenhum problema grave", () => {
    const rating = { nota: 4, comentario: "", usaria_de_novo: true };
    const clean = { utilidade: 4, problemas: [], observacao: "" };
    assert.equal(accept(rating, clean, []).accepted, true);
    assert.equal(accept({ ...rating, nota: 3 }, clean, []).accepted, false);
    const grave = { ...clean, problemas: [{ codigo: "inventou_fato" as const, gravidade: "grave" as const, trecho: "x" }] };
    assert.equal(accept(rating, grave, []).accepted, false);
    const leve = { ...clean, problemas: [{ codigo: "tom_artificial" as const, gravidade: "leve" as const, trecho: "x" }] };
    assert.equal(accept(rating, leve, []).accepted, true);
  });
});

describe("runConversation", () => {
  const scenario = SCENARIOS[0];

  it("o líder simulado conduz sozinho até o agente encerrar e a conversa é avaliada", async () => {
    let agentCalls = 0;
    const agent: FeedbackProvider = {
      async complete() {
        agentCalls += 1;
        return agentCalls < 3 ? "Conta mais." : `Já dá para seguir.\n\n${CLOSING_PHRASE}`;
      },
    };
    const deps: Deps = {
      agent,
      nextLeader: async () => "continuo",
      rate: async () => ({ nota: 5, comentario: "ajudou", usaria_de_novo: true }),
      judge: async () => ({ utilidade: 5, problemas: [], observacao: "" }),
    };
    const result = await runConversation(deps, scenario);
    assert.equal(result.simulated, true);
    assert.equal(result.exchanges, 3);
    assert.equal(result.endedBy, "agent_closed");
    assert.equal(result.history[0].content, scenario.opening);
    assert.equal(result.acceptance?.accepted, true);
  });

  it("falha do provider interrompe sem avaliar", async () => {
    const deps: Deps = {
      agent: { complete: async () => { throw new Error("fora do ar"); } },
      nextLeader: async () => "x",
      rate: async () => { throw new Error("não deveria avaliar"); },
      judge: async () => { throw new Error("não deveria avaliar"); },
    };
    const result = await runConversation(deps, scenario);
    assert.equal(result.endedBy, "provider_error");
    assert.equal(result.acceptance, undefined);
  });
});
