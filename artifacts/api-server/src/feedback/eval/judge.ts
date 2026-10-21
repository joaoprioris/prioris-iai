import { callAnthropic } from "../anthropic-provider.ts";
import { CLOSING_PHRASE, MAX_EXCHANGES } from "../guidance.ts";
import { countExchanges, type ChatMessage } from "../conversation.ts";
import type { LeaderRating } from "./simulated-leader.ts";

type Client = Parameters<typeof callAnthropic>[0];

export const PROBLEMS = [
  "inventou_fato",
  "presumiu_sentimento_ou_reacao",
  "garantiu_reacao",
  "fala_pronta_excessiva",
  "pergunta_repetida_ou_sem_avanco",
  "escolheu_pelo_lider",
  "teoria_ou_aula",
  "expos_metodo",
  "resposta_generica",
  "ignorou_ativacao_emocional",
  "tom_artificial",
] as const;

export type Problem = (typeof PROBLEMS)[number];

export interface Verdict {
  utilidade: number;
  problemas: { codigo: Problem; gravidade: "grave" | "leve"; trecho: string }[];
  observacao: string;
}

const MAX_JUDGE_TOKENS = 2500;

const CRITERIA = `Critérios do agente de Feedback do IAí (voz única, apoia o líder no momento de decisão sob pressão):
- Entende a dificuldade real usando só o que o líder contou; mostra a tensão entre clareza e relação; explora o objetivo e a abordagem do líder.
- Ajuda a tornar a intenção clara. Exemplos curtos, opcionais e adaptáveis são permitidos. Não entrega discurso completo pronto.
- O líder mantém a autoria da decisão e do próximo passo. O agente não escolhe por ele.
- Não assume sentimentos, causas, intenções ou reações da outra pessoa que o líder não relatou. Não garante como a pessoa vai reagir. Não inventa detalhes. Distingue impressão de fato.
- Se o líder está emocionalmente ativado, reconhece e cria uma pausa curta antes de seguir.
- Sem teoria, sem aula, sem sequência mecânica de perguntas, sem linguagem artificial ou de IA. Não expõe método, agentes, dívidas ou classificação.
- Encerra quando há clareza para o próximo passo, em até ${MAX_EXCHANGES} trocas.`;

const CODES = PROBLEMS.join(", ");

export function parseVerdict(text: string): Verdict {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const raw = JSON.parse(json) as Partial<Verdict>;
  const utilidade = Number(raw.utilidade);
  if (!Number.isInteger(utilidade) || utilidade < 1 || utilidade > 5) throw new Error("utilidade fora de 1 a 5");
  const problemas = (raw.problemas ?? []).map((item) => {
    if (!PROBLEMS.includes(item.codigo)) throw new Error(`código de problema desconhecido: ${String(item.codigo)}`);
    return {
      codigo: item.codigo,
      gravidade: item.gravidade === "leve" ? ("leve" as const) : ("grave" as const),
      trecho: String(item.trecho ?? ""),
    };
  });
  return { utilidade, problemas, observacao: String(raw.observacao ?? "") };
}

/** Avaliador independente: lê a conversa inteira, não só a última resposta. */
export async function judgeConversation(
  client: Client,
  model: string,
  foco: string,
  history: ChatMessage[],
): Promise<Verdict> {
  const transcript = history
    .map((message, index) => `[${index + 1}] ${message.role === "user" ? "Líder (simulado)" : "IAí"}: ${message.content}`)
    .join("\n\n");
  const { text } = await callAnthropic(client, {
    model,
    system: `Você avalia conversas de teste entre um líder simulado e o IAí. Seja rigoroso e cite trechos literais. Não elogie por padrão.\n\n${CRITERIA}`,
    messages: [
      {
        role: "user",
        content: `Foco do cenário: ${foco}\n\nConversa completa:\n\n${transcript}\n\nAvalie a conversa inteira. Responda somente com JSON no formato {"utilidade": 1 a 5 (quanto ajudou o líder a sair com algo utilizável), "problemas": [{"codigo": um de [${CODES}], "gravidade": "grave" ou "leve", "trecho": "trecho literal"}], "observacao": "duas frases"}. Use lista vazia se não houver problemas.`,
      },
    ],
    maxTokens: MAX_JUDGE_TOKENS,
    effort: "medium",
  });
  return parseVerdict(text);
}

const FORBIDDEN_IN_REPLIES = [/terap/i, /d[ií]vidas? cultura(l|is)/i, /\bMIC\b/, /matriz de/i, /\bagente\b/i, /classifica/i];

/** Verificações determinísticas, independentes de qualquer modelo. */
export function deterministicChecks(history: ChatMessage[]): string[] {
  const failures: string[] = [];
  const replies = history.filter((message) => message.role === "assistant");
  if (countExchanges(history) > MAX_EXCHANGES) failures.push("mais de dez trocas");
  const last = replies[replies.length - 1];
  if (!last || !last.content.trimEnd().endsWith(CLOSING_PHRASE)) failures.push("não encerrou com a frase de saída");
  for (const reply of replies.slice(0, -1)) {
    if (reply.content.includes(CLOSING_PHRASE)) failures.push("frase de saída antes do encerramento");
  }
  for (const reply of replies) {
    for (const pattern of FORBIDDEN_IN_REPLIES) {
      if (pattern.test(reply.content)) failures.push(`termo vetado na resposta: ${pattern.source}`);
    }
  }
  return failures;
}

export interface Acceptance {
  accepted: boolean;
  reasons: string[];
}

/** Conversa satisfatória: o líder simulado aprova, o avaliador não acha problema grave e as regras fixas passam. */
export function accept(rating: LeaderRating, verdict: Verdict, checks: string[]): Acceptance {
  const reasons: string[] = [...checks];
  if (rating.nota < 4) reasons.push(`nota do líder simulado ${rating.nota}`);
  if (verdict.utilidade < 4) reasons.push(`utilidade segundo o avaliador ${verdict.utilidade}`);
  for (const problem of verdict.problemas) {
    if (problem.gravidade === "grave") reasons.push(`problema grave: ${problem.codigo}`);
  }
  return { accepted: reasons.length === 0, reasons };
}
