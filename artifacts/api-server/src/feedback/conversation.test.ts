import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countExchanges,
  MAX_USER_MESSAGE_CHARS,
  runTurn,
  stripTrailingQuestions,
  type ChatMessage,
  type FeedbackProvider,
} from "./conversation.ts";
import { CLOSING_PHRASE, FEEDBACK_GUIDANCE, MAX_EXCHANGES, styleIssues } from "./guidance.ts";

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

  it("orienta a calibração pelas cinco dimensões sem expor o método", () => {
    for (const dimension of ["tempo", "linguagem", "direção", "exposição", "intensidade"]) {
      assert.ok(FEEDBACK_GUIDANCE.includes(dimension), dimension);
    }
    assert.doesNotMatch(FEEDBACK_GUIDANCE, /\bMIC\b/);
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
    assert.deepEqual(calls[0].messages.at(-1), {
      role: "user",
      content: "preciso cobrar uma pessoa",
    });
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
    assert.deepEqual(await runTurn(other, result.history, "mais uma coisa"), {
      status: "closed",
    });
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
      assert.deepEqual(await runTurn(provider, history, "oi"), {
        status: "error",
      });
    }
    assert.equal(countExchanges(history), 2);
  });

  it("rejeita fala vazia ou longa demais sem chamar o provider", async () => {
    const { provider, calls } = fakeProvider("x");
    assert.deepEqual(await runTurn(provider, [], "   "), {
      status: "invalid",
      reason: "empty",
    });
    assert.deepEqual(await runTurn(provider, [], "a".repeat(MAX_USER_MESSAGE_CHARS + 1)), {
      status: "invalid",
      reason: "too_long",
    });
    assert.equal(calls.length, 0);
  });
});

describe("vocabulário vetado", () => {
  it("regenera uma vez com aviso e entrega a segunda resposta", async () => {
    const replies = ["Parece conversa de terapia, mas dá para seguir.", "Dá para seguir com uma conversa direta."];
    const calls: string[] = [];
    const provider: FeedbackProvider = {
      async complete(input) {
        calls.push(JSON.stringify(input));
        return replies[calls.length - 1];
      },
    };
    const result = await runTurn(provider, [], "não quero soar como terapia de RH");
    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.reply, replies[1]);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].includes("vocabulário proibido"));
  });

  it("devolve erro sem consumir troca se a segunda resposta também usar o termo", async () => {
    const { provider, calls } = fakeProvider("Isso é quase uma terapia.");
    const result = await runTurn(provider, [], "oi");
    assert.equal(result.status, "error");
    assert.equal(calls.length, 2);
  });
});

describe("encerramento sem pergunta", () => {
  it("regenera a última troca quando a resposta termina com pergunta", async () => {
    const replies = [
      "Você decidiu falar amanhã. Qual será a primeira frase?",
      "Você decidiu falar amanhã, com as suas palavras.",
    ];
    const calls: string[] = [];
    const provider: FeedbackProvider = {
      async complete(input) {
        calls.push(JSON.stringify(input));
        return replies[calls.length - 1];
      },
    };
    const result = await runTurn(provider, historyWith(MAX_EXCHANGES - 1), "fechado");
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.ok(!result.reply.includes("?"));
      assert.ok(result.closed);
    }
    assert.equal(calls.length, 2);
  });
});

describe("stripTrailingQuestions", () => {
  it("tira só a pergunta que fecha o texto", () => {
    assert.equal(stripTrailingQuestions("Você decidiu falar amanhã. Qual será a frase?"), "Você decidiu falar amanhã.");
  });

  it("mantém perguntas dentro de aspas e no meio do texto", () => {
    const text = 'Você pode abrir com "o que você viu nessas reuniões?". Isso basta.';
    assert.equal(stripTrailingQuestions(text), text);
    const quoted = 'Uma saída é perguntar "como você está vendo isso?"';
    assert.equal(stripTrailingQuestions(quoted), quoted);
  });
});

describe("regras de estilo impostas por código", () => {
  it("detecta abertura de validação, autocorreção, resposta longa e fala inteira entre aspas", () => {
    assert.deepEqual(
      styleIssues("Faz sentido o que você disse.").map((i) => i.code),
      ["abertura_validando"],
    );
    assert.deepEqual(
      styleIssues("Eu acelerei demais, vamos voltar ao fato.").map((i) => i.code),
      ["autocorrecao"],
    );
    assert.deepEqual(
      styleIssues("palavra ".repeat(160)).map((i) => i.code),
      ["resposta_longa"],
    );
    const fala = `Diga: "${"Preciso que o relatório chegue até sexta de manhã porque ele alimenta a reunião de segunda, e quando chega depois eu perco a janela de revisar tudo com calma antes de levar para a diretoria"}".`;
    assert.deepEqual(
      styleIssues(fala).map((i) => i.code),
      ["fala_pronta"],
    );
    assert.deepEqual(styleIssues("O atraso é o fato, a leitura é sua."), []);
  });

  it("reescreve uma vez e entrega a versão sem o problema", async () => {
    const replies = ["Entendo a raiva. Espere antes de enviar.", "Espere antes de enviar."];
    const calls: string[] = [];
    const provider: FeedbackProvider = {
      async complete(input) {
        calls.push(JSON.stringify(input));
        return replies[calls.length - 1];
      },
    };
    const result = await runTurn(provider, [], "quero mandar agora");
    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.reply, replies[1]);
    assert.equal(calls.length, 2);
  });

  it("detecta cansaço do líder com pergunta na resposta e pergunta repetida", () => {
    const frustrado = { leaderMessage: "Você tá me devolvendo pergunta demais, me fala logo." };
    assert.ok(styleIssues("O que você quer dizer a ela?", frustrado).some((i) => i.code === "pergunta_apos_cansaco"));
    assert.deepEqual(styleIssues("Diga o fato e o pedido, nessa ordem.", frustrado), []);
    const anteriores = { previousReplies: ["Qual atraso você quer trazer primeiro para essa conversa?"] };
    assert.ok(
      styleIssues("Então, qual atraso você quer trazer primeiro nessa conversa?", anteriores).some(
        (i) => i.code === "pergunta_repetida",
      ),
    );
    assert.deepEqual(styleIssues("Quando você consegue marcar essa conversa?", anteriores), []);
  });

  it("injeta a instrução de cansaço no sistema quando o líder reclama", async () => {
    const calls: string[] = [];
    const provider: FeedbackProvider = {
      async complete(input) {
        calls.push(input.system);
        return "Diga o fato e o pedido, nessa ordem.";
      },
    };
    await runTurn(provider, [], "Você tá me devolvendo pergunta demais, me fala logo.");
    assert.ok(calls[0].includes("cansaço ou impaciência"));
  });
});
