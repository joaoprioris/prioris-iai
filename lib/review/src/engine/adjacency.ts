import type { DebtCode } from "../debts.ts";

/**
 * Adjacência no motor: uso INTERNO e exploratório.
 *
 * A adjacência é registrada em cada SED (`debt_adjacent`) como hipótese da matriz: a próxima distorção provável se
 * o padrão continuar. Este módulo procura pares (principal, adjacente) que se repetem ciclo após ciclo num grupo,
 * sinal de que a dívida principal pode estar se convertendo na adjacente. Serve para análise preditiva futura.
 *
 * Regras:
 * - Nunca é apresentado ao cliente (nem no painel, nem na matriz, nem em alertas) enquanto não houver certeza de que
 *   as dívidas realmente se correlacionam e se alimentam. Toda saída leva `visibility: "internal"`.
 * - Os parâmetros não têm valor padrão: o limiar de recorrência depende de decisão do proprietário.
 * - A entrada já vem do banco com a mesma supressão do restante (ciclo encerrado, 3 participantes distintos).
 * - Adjacência antecipada não é uma segunda ocorrência: aqui ela nunca soma à contagem da dívida adjacente.
 */
export interface AdjacencyRow {
  group_id: number;
  /** Primeiro dia do mês UTC, `YYYY-MM-DD`. */
  cycle_start: string;
  debt_principal: DebtCode;
  debt_adjacent: DebtCode;
  events: number;
}

export interface PrincipalRow {
  group_id: number;
  cycle_start: string;
  debt_principal: DebtCode;
  events: number;
}

export interface EmergingParams {
  /** Mínimo de ciclos mensais consecutivos, terminando no último ciclo observado. */
  minConsecutiveCycles: number;
  /** Mínimo de eventos do par em cada um desses ciclos. */
  minEventsPerCycle: number;
}

export interface PairTrack {
  visibility: "internal";
  groupId: number;
  principal: DebtCode;
  adjacent: DebtCode;
  /** Ciclos com o par, em ordem, e a contagem em cada um. */
  cycles: { cycle: string; events: number }[];
  /** Ciclos consecutivos (com pelo menos `minEventsPerCycle` eventos) até o último ciclo observado. */
  consecutiveCycles: number;
  /**
   * Ciclos posteriores ao primeiro registro do par em que a dívida adjacente apareceu como PRINCIPAL no mesmo
   * grupo. É a evidência bruta de conversão; só serve para testar a hipótese, não para afirmá-la.
   */
  adjacentAsPrincipalAfter: number;
}

const monthIndex = (cycle: string): number => {
  const [year, month] = cycle.split("-").map(Number);
  return year * 12 + (month - 1);
};

/** Une os pares por grupo e calcula a sequência de ciclos consecutivos. Não filtra: use `emergingPairs`. */
export function trackPairs(
  adjacency: readonly AdjacencyRow[],
  principals: readonly PrincipalRow[],
  minEventsPerCycle: number,
): PairTrack[] {
  if (!Number.isInteger(minEventsPerCycle) || minEventsPerCycle < 1) throw new Error("minEventsPerCycle must be a positive integer");
  if (adjacency.length === 0) return [];
  const latest = Math.max(...adjacency.map((row) => monthIndex(row.cycle_start)));
  const byKey = new Map<string, AdjacencyRow[]>();
  for (const row of adjacency) {
    if (row.debt_principal === row.debt_adjacent) continue;
    const key = `${row.group_id}|${row.debt_principal}|${row.debt_adjacent}`;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  const tracks: PairTrack[] = [];
  for (const rows of byKey.values()) {
    const sorted = [...rows].sort((a, b) => monthIndex(a.cycle_start) - monthIndex(b.cycle_start));
    const first = sorted[0];
    const strong = new Set(sorted.filter((row) => row.events >= minEventsPerCycle).map((row) => monthIndex(row.cycle_start)));
    let consecutive = 0;
    for (let month = latest; strong.has(month); month--) consecutive++;
    const firstMonth = monthIndex(first.cycle_start);
    const converted = new Set(
      principals
        .filter(
          (p) =>
            p.group_id === first.group_id &&
            p.debt_principal === first.debt_adjacent &&
            p.events > 0 &&
            monthIndex(p.cycle_start) > firstMonth,
        )
        .map((p) => monthIndex(p.cycle_start)),
    );
    tracks.push({
      visibility: "internal",
      groupId: first.group_id,
      principal: first.debt_principal,
      adjacent: first.debt_adjacent,
      cycles: sorted.map((row) => ({ cycle: row.cycle_start, events: row.events })),
      consecutiveCycles: consecutive,
      adjacentAsPrincipalAfter: converted.size,
    });
  }
  return tracks.sort(
    (a, b) => b.consecutiveCycles - a.consecutiveCycles || a.groupId - b.groupId || a.principal.localeCompare(b.principal),
  );
}

/** Pares que se repetem por pelo menos `minConsecutiveCycles` ciclos até o último observado. Interno. */
export function emergingPairs(
  adjacency: readonly AdjacencyRow[],
  principals: readonly PrincipalRow[],
  params: EmergingParams,
): PairTrack[] {
  if (!Number.isInteger(params.minConsecutiveCycles) || params.minConsecutiveCycles < 1) {
    throw new Error("minConsecutiveCycles must be a positive integer");
  }
  return trackPairs(adjacency, principals, params.minEventsPerCycle).filter(
    (track) => track.consecutiveCycles >= params.minConsecutiveCycles,
  );
}
