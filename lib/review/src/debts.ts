/**
 * Catálogo das 10 Dívidas Culturais. O contrato usa o código textual, nunca a posição: a numeração varia entre
 * os documentos (Matriz Executiva x Manual de Auditoria) e o Mestre manda referir pelo nome.
 * Não existe equivalência por semelhança de palavras: só o nome oficial e os apelidos listados aqui, que são
 * os nomes curtos usados nas bibliotecas de momentos dos agentes.
 */
export const QUADRANTS = ["paralisia", "retrabalho", "cinismo", "ruptura"] as const;
export type Quadrant = (typeof QUADRANTS)[number];

export const DEBTS = [
  { code: "evitacao_conflito", name: "Evitação de Conflito", quadrant: "paralisia", aliases: [] },
  { code: "decisao_postergada", name: "Decisão Postergada", quadrant: "paralisia", aliases: [] },
  { code: "comunicacao_ambigua", name: "Comunicação Ambígua", quadrant: "retrabalho", aliases: [] },
  { code: "autoridade_fragilizada", name: "Autoridade Fragilizada", quadrant: "retrabalho", aliases: [] },
  { code: "accountability_diluida", name: "Accountability Diluída", quadrant: "retrabalho", aliases: [] },
  { code: "confianca_erosionada", name: "Confiança Erosionada", quadrant: "cinismo", aliases: [] },
  { code: "aprendizado_bloqueado", name: "Aprendizado Bloqueado", quadrant: "cinismo", aliases: [] },
  { code: "alinhamento_simbolico", name: "Alinhamento Simbólico", quadrant: "cinismo", aliases: [] },
  {
    code: "energia_emocional_degradada",
    name: "Energia Emocional Degradada",
    quadrant: "ruptura",
    aliases: ["Energia Emocional"],
  },
  {
    code: "maturidade_politica_insuficiente",
    name: "Maturidade Política Insuficiente",
    quadrant: "ruptura",
    aliases: ["Maturidade Política"],
  },
] as const;

export type DebtCode = (typeof DEBTS)[number]["code"];
export const DEBT_CODES: readonly DebtCode[] = DEBTS.map((debt) => debt.code);

export const isDebtCode = (value: unknown): value is DebtCode =>
  typeof value === "string" && (DEBT_CODES as readonly string[]).includes(value);

export const quadrantOf = (code: DebtCode): Quadrant => DEBTS.find((debt) => debt.code === code)!.quadrant;

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

const BY_NAME = new Map<string, DebtCode>(
  DEBTS.flatMap((debt) => [debt.name, ...debt.aliases].map((name) => [normalize(name), debt.code] as const)),
);

/** Resolve nome oficial ou apelido listado (ignora caixa e acento). Qualquer outro texto devolve null. */
export const debtFromName = (name: string): DebtCode | null => BY_NAME.get(normalize(name)) ?? null;
