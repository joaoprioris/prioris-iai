import { DEBT_CODES, type DebtCode } from "./debts.ts";

/**
 * Banco de perguntas da pesquisa silenciosa: 3 afirmações por dívida (Manual Oficial de Auditoria, Bloco 6).
 * Entrega ao líder: 20 a 25 itens em no mínimo 6 meses, nunca em sequência por dívida (Health Monitor, 3.3).
 * O peso de cada item (R, I ou I+) ainda não foi definido em nenhum documento: fica nulo no esquema.
 * Escala: 0 Nunca, 1 Raramente, 2 Às vezes, 3 Frequentemente, 4 Quase sempre.
 */
export const SCALE_LABELS = ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Quase sempre"] as const;

export const QUESTION_BANK: Record<DebtCode, readonly [string, string, string]> = {
  evitacao_conflito: [
    "Conversas difíceis costumam ser adiadas na minha área.",
    "Questões sensíveis são frequentemente suavizadas para evitar tensão.",
    "Problemas interpessoais levam tempo para ser tratados abertamente.",
  ],
  decisao_postergada: [
    "Decisões importantes costumam ser adiadas.",
    "Reuniões terminam sem encaminhamentos claros.",
    "Temas críticos retornam diversas vezes sem fechamento.",
  ],
  comunicacao_ambigua: [
    "Orientações importantes nem sempre são completamente claras.",
    "Mudanças de direção acontecem sem explicação completa.",
    "As expectativas nem sempre ficam explícitas desde o início.",
  ],
  autoridade_fragilizada: [
    "Decisões já tomadas costumam ser revistas mais de uma vez.",
    "Existe insegurança sobre quem tem a palavra final em alguns temas.",
    "Delegações importantes são acompanhadas de muitas interferências.",
  ],
  accountability_diluida: [
    "Nem sempre fica claro quem é responsável por uma decisão.",
    "Quando algo dá errado, a responsabilidade tende a se diluir.",
    "Há situações em que ninguém assume claramente a condução.",
  ],
  confianca_erosionada: [
    "Há necessidade frequente de checagens e controles adicionais.",
    "A autonomia concedida nem sempre é sustentada na prática.",
    // O Manual traz "saía"; corrigido para "saia" (registrado em CORRECOES_DOCUMENTOS.md).
    "Existe receio de que algo saia errado se não houver acompanhamento próximo.",
  ],
  aprendizado_bloqueado: [
    "Erros recorrentes acontecem sem uma reflexão estruturada.",
    "Há pouca discussão sobre aprendizados após situações difíceis.",
    "Problemas semelhantes reaparecem ao longo do tempo.",
  ],
  alinhamento_simbolico: [
    "O discurso institucional nem sempre se reflete no dia a dia.",
    "Valores declarados entram em conflito com práticas reais.",
    "Algumas mensagens institucionais soam distantes da realidade.",
  ],
  energia_emocional_degradada: [
    "A sensação de cansaço é frequente entre as lideranças.",
    "Situações de pressão se acumulam sem espaço de elaboração.",
    "O clima emocional tende a ficar pesado em momentos críticos.",
  ],
  maturidade_politica_insuficiente: [
    "Decisões são influenciadas por jogos de poder informais.",
    "Temas sensíveis exigem cuidados políticos excessivos.",
    "Algumas conversas são evitadas por risco político.",
  ],
};

export interface Question {
  id: string;
  debt: DebtCode;
  item: 1 | 2 | 3;
  text: string;
}

/** Identificador estável: `<código da dívida>.<item 1 a 3>`. */
export const questionId = (debt: DebtCode, item: 1 | 2 | 3): string => `${debt}.${item}`;

export const QUESTIONS: readonly Question[] = DEBT_CODES.flatMap((debt) =>
  QUESTION_BANK[debt].map((text, index) => {
    const item = (index + 1) as 1 | 2 | 3;
    return { id: questionId(debt, item), debt, item, text };
  }),
);

export const QUESTION_IDS: ReadonlySet<string> = new Set(QUESTIONS.map((question) => question.id));
