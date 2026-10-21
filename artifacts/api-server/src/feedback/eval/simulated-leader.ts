import { callAnthropic } from "../anthropic-provider.ts";
import type { ChatMessage } from "../conversation.ts";
import type { Scenario } from "./scenarios.ts";

type Client = Parameters<typeof callAnthropic>[0];

export interface LeaderRating {
  nota: number;
  comentario: string;
  usaria_de_novo: boolean;
}

const MAX_LEADER_TOKENS = 400;

function persona(scenario: Scenario): string {
  return `Isto é uma simulação de teste. Você interpreta um líder real que usa o IAí, um app de apoio a decisões de liderança, para pensar sobre uma situação do trabalho.

Ficha da situação (use apenas estes fatos; se perguntarem algo que a ficha não cobre, responda de forma plausível e curta, sem contradizer a ficha):
${scenario.ficha}

Jeito de agir: ${scenario.comportamento}

Regras:
- Fale como uma pessoa real digitando: frases curtas e naturais, às vezes incompletas, sem listas.
- Reaja de verdade ao que o IAí disser. Se a resposta for genérica, longa demais, parecer roteiro ou presumir algo que você não contou, diga isso do seu jeito.
- Não ajude o IAí a acertar. Revele fatos só quando fizer sentido na conversa.
- Responda somente com a próxima fala do líder, sem aspas e sem comentários.`;
}

/** Visão do líder simulado: o IAí fala como "user" e o líder como "assistant". */
export function leaderView(history: ChatMessage[]): ChatMessage[] {
  const swapped = history.map((message) => ({
    role: message.role === "user" ? ("assistant" as const) : ("user" as const),
    content: message.content,
  }));
  return [{ role: "user", content: "Início da simulação." }, ...swapped];
}

export async function nextLeaderMessage(
  client: Client,
  model: string,
  scenario: Scenario,
  history: ChatMessage[],
): Promise<string> {
  const { text } = await callAnthropic(client, {
    model,
    system: persona(scenario),
    messages: leaderView(history),
    maxTokens: MAX_LEADER_TOKENS,
    effort: "low",
  });
  return text.replace(/^["“]|["”]$/g, "").trim();
}

export function parseRating(text: string): LeaderRating {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const raw = JSON.parse(json) as Partial<LeaderRating>;
  const nota = Number(raw.nota);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new Error("nota fora de 1 a 5");
  return { nota, comentario: String(raw.comentario ?? ""), usaria_de_novo: raw.usaria_de_novo === true };
}

/** Avaliação do próprio líder simulado, do ponto de vista de quem usou. */
export async function rateConversation(
  client: Client,
  model: string,
  scenario: Scenario,
  history: ChatMessage[],
): Promise<LeaderRating> {
  const transcript = history
    .map((message) => `${message.role === "user" ? "Líder" : "IAí"}: ${message.content}`)
    .join("\n\n");
  const { text } = await callAnthropic(client, {
    model,
    system: persona(scenario),
    messages: [
      {
        role: "user",
        content: `A conversa terminou. Transcrição:\n\n${transcript}\n\nComo esse líder avalia o que recebeu? Considere se ajudou de verdade com a situação da ficha, se soube ouvir e se saiu com algo que dá para usar. Responda somente com JSON no formato {"nota": 1 a 5, "comentario": "uma ou duas frases na voz do líder", "usaria_de_novo": true ou false}.`,
      },
    ],
    maxTokens: MAX_LEADER_TOKENS,
    effort: "low",
  });
  return parseRating(text);
}
