import { MOMENTOS, momentoPorId, type Custo, type DividaCodigo, type Fase } from "../moments.ts";
import { PROPOSED_SCENARIOS } from "./proposed-scenarios.ts";
import { SCENARIOS } from "./scenarios.ts";

/**
 * Mapeamento dos cenários de teste para a biblioteca de 80 momentos, feito por leitura (não há marcador nos
 * cenários). `exatos`: o cenário reproduz o momento. `aproximados`: o momento mais próximo, sem equivalência.
 * Cenário sem nenhum momento testa uma regra do agente (autoria, separar fato de impressão, reconhecimento),
 * não um momento da biblioteca.
 */
export interface CoverageEntry {
  cenario: string;
  exatos: readonly number[];
  aproximados: readonly number[];
}

export const COVERAGE: readonly CoverageEntry[] = [
  { cenario: "cobranca-relacional", exatos: [], aproximados: [11] },
  { cenario: "feedback-para-senior", exatos: [28], aproximados: [] },
  { cenario: "adiando-ha-semanas", exatos: [11], aproximados: [] },
  { cenario: "reacao-defensiva-agora", exatos: [65], aproximados: [] },
  { cenario: "feedback-recebido-injusto", exatos: [2], aproximados: [] },
  { cenario: "interpretado-como-elogio", exatos: [26], aproximados: [] },
  { cenario: "boa-conversa-nada-muda", exatos: [8], aproximados: [] },
  { cenario: "mesmo-feedback-tres-vezes", exatos: [60], aproximados: [] },
  { cenario: "algo-errado-sem-nome", exatos: [], aproximados: [55] },
  { cenario: "ativado-emocionalmente", exatos: [61], aproximados: [] },
  { cenario: "quer-fala-pronta", exatos: [], aproximados: [] },
  { cenario: "reconhecimento", exatos: [], aproximados: [] },
  { cenario: "preparar-objecoes", exatos: [], aproximados: [] },
  { cenario: "impressao-versus-fato", exatos: [], aproximados: [] },
];

export interface CoverageReport {
  cells: Map<string, number[]>;
  debts: Map<DividaCodigo, number[]>;
  missingCells: string[];
  missingDebts: DividaCodigo[];
}

export const CUSTOS: readonly Custo[] = ["paralisia", "retrabalho", "cinismo", "ruptura"];
export const FASES: readonly Fase[] = ["Antes", "Durante", "Depois"];
export const cellKey = (custo: Custo, fase: Fase): string => `${custo}/${fase}`;

export function report(momentIds: readonly number[]): CoverageReport {
  const cells = new Map<string, number[]>();
  const debts = new Map<DividaCodigo, number[]>();
  for (const id of momentIds) {
    const momento = momentoPorId(id)!;
    const key = cellKey(momento.custo, momento.fase);
    cells.set(key, [...(cells.get(key) ?? []), id]);
    debts.set(momento.divida, [...(debts.get(momento.divida) ?? []), id]);
  }
  const allDebts = [...new Set(MOMENTOS.map((momento) => momento.divida))];
  return {
    cells,
    debts,
    missingCells: CUSTOS.flatMap((custo) => FASES.map((fase) => cellKey(custo, fase))).filter((key) => !cells.has(key)),
    missingDebts: allDebts.filter((divida) => !debts.has(divida)),
  };
}

export const currentMoments = (): number[] => COVERAGE.flatMap((entry) => [...entry.exatos]);
export const withProposals = (): number[] => [...currentMoments(), ...PROPOSED_SCENARIOS.map((s) => s.momento)];
export const scenarioIds = (): string[] => SCENARIOS.map((scenario) => scenario.id);
