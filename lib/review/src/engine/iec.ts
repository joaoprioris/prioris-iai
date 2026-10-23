/**
 * Motor do IEC v1.0 como funções puras. Os coeficientes são os do ensaio determinístico de 11/10/2026
 * e não têm calibração estatística nem validação científica; ficam injetáveis por isso.
 * O motor recebe agregados já liberados (ciclo encerrado, n >= 3). Não calcula nada a partir de um evento.
 */
import type { DebtCode } from "../debts.ts";

export interface IecParams {
  alpha: number;
  beta: number;
  lambda: number;
  k: number;
  /** Baseline de ocorrências por ciclo de apuração (unidade ainda a definir pelo dono). */
  T: number;
  wR: number;
  wI: number;
  wC: number;
  /** Limiar de ocorrência relevante para contar o tempo de amortecimento (f_d > limiar). */
  relevantFrequency: number;
}

export const DEFAULT_PARAMS: IecParams = {
  alpha: 1.25,
  beta: 0.15,
  lambda: 0.08,
  k: 0.35,
  T: 20,
  wR: 0.4,
  wI: 0.35,
  wC: 0.25,
  relevantFrequency: 2,
};

export const recurrence = (f: number, p: IecParams = DEFAULT_PARAMS): number =>
  f > 0 ? Math.min(1, (f / p.T) ** p.alpha) : 0;

export const concentration = (n: number, p: IecParams = DEFAULT_PARAMS): number => 1 - Math.exp(-p.k * n);

export const sensitivity = (adjacentSum: number, p: IecParams = DEFAULT_PARAMS): number =>
  1 + p.beta * adjacentSum;

export const damping = (deltaT: number, p: IecParams = DEFAULT_PARAMS): number => Math.exp(-p.lambda * deltaT);

export interface DebtSeries {
  /** Frequência por ciclo de apuração. */
  frequency: number[];
  /** I_d (0 a 1), escalar ou por ciclo. A conversão a partir da intensidade proxy é decisão pendente. */
  intensity: number | number[];
  /** Concentração: número de áreas afetadas (distintas), escalar ou por ciclo. */
  areas: number | number[];
  /** Soma ponderada dos IEC adjacentes ativos (0 a 1 cada), por ciclo. */
  adjacentSum: number[];
}

const at = (value: number | number[], index: number): number => (Array.isArray(value) ? value[index] : value);

/** Série do IEC em percentual (0 a 100), sem arredondar. */
export function iecSeries(series: DebtSeries, p: IecParams = DEFAULT_PARAMS): number[] {
  return series.frequency.map((f, t) => {
    const base =
      recurrence(f, p) * p.wR + at(series.intensity, t) * p.wI + concentration(at(series.areas, t), p) * p.wC;
    let lastRelevant = -1;
    for (let i = 0; i <= t; i++) if (series.frequency[i] > p.relevantFrequency) lastRelevant = i;
    const deltaT = lastRelevant >= 0 ? t - lastRelevant : t;
    const value = base * sensitivity(series.adjacentSum[t] ?? 0, p) * damping(deltaT, p);
    return Math.min(1, Math.max(0, value)) * 100;
  });
}

/**
 * IEC simplificado: só R, I e C, sem S e A, em percentual. O Manual de Auditoria (4.2) o cita para a entrega
 * executiva; o Mestre, o Doc 2, o Doc 3 e o Doc 6 usam a fórmula completa. O motor guarda os dois e a escolha
 * do que aparece ao cliente é decisão do proprietário.
 */
export function iecSimplifiedSeries(series: DebtSeries, p: IecParams = DEFAULT_PARAMS): number[] {
  return series.frequency.map((f, t) => {
    const base =
      recurrence(f, p) * p.wR + at(series.intensity, t) * p.wI + concentration(at(series.areas, t), p) * p.wC;
    return Math.min(1, Math.max(0, base)) * 100;
  });
}

/**
 * IEC global da organização (Doc 2, 3.3): soma(IEC_d x pi_d) / 10. Recebe exatamente as 10 dívidas;
 * pi padrão 1 (ajuste só por decisão documentada do RH ou do Conselho). Mesma escala da entrada.
 * O divisor 10 com pi diferente de 1 está em aberto (D09).
 */
export function iecGlobal(
  scores: Record<DebtCode, number | null>,
  pi: Partial<Record<DebtCode, number>> = {},
): number | null {
  const entries = Object.entries(scores) as [DebtCode, number | null][];
  if (entries.length !== 10) throw new RangeError("iecGlobal exige as 10 dívidas");
  // Dívida com dado insuficiente não vira zero: sem as 10 pontuações, não há IEC global.
  if (entries.some(([, iec]) => iec === null)) return null;
  return entries.reduce((sum, [debt, iec]) => sum + (iec as number) * (pi[debt] ?? 1), 0) / 10;
}

export type Zone = "Verde" | "Amarela" | "Vermelha";
/** Dado insuficiente não é zero nem zona verde (D10): a dívida aparece na matriz marcada como insuficiente. */
export type ZoneOrInsufficient = Zone | "Insuficiente";

/**
 * Cortes em 40 e 70 sobre o valor sem arredondar. O tratamento de valores entre 39 e 40 e entre 69 e 70
 * (arredondamento antes ou depois do corte) está em aberto (D09).
 */
export const zone = (iec: number): Zone => (iec < 40 ? "Verde" : iec < 70 ? "Amarela" : "Vermelha");

export const zoneOf = (iec: number | null | undefined): ZoneOrInsufficient =>
  iec === null || iec === undefined || Number.isNaN(iec) ? "Insuficiente" : zone(iec);

/** Multiplicador do DCO por faixa de IEC (Dossiê, Parte 9). */
export function dcoMultiplier(iec: number): 0.7 | 1.0 | 1.4 | 1.8 {
  if (iec < 40) return 0.7;
  if (iec < 70) return 1.0;
  return iec < 85 ? 1.4 : 1.8;
}

export interface DcoInput {
  /** Episódios por ano. */
  R: number;
  /** Horas perdidas por episódio. */
  T: number;
  /** Pessoas afetadas. */
  P: number;
  /** Custo médio por hora em reais. */
  C: number;
  iec: number;
}

/** DCO de uma dívida em reais. R, T, P e C vêm do cliente ou de estimativa contratada, não do SED. */
export const dco = (item: DcoInput): number => item.R * item.T * item.P * item.C * dcoMultiplier(item.iec);

export interface RankedDebt {
  debt: DebtCode;
  /** Nulo = dado insuficiente. */
  iec: number | null;
  /** Peso político G_d definido pelo Conselho (padrão 1). */
  weight?: number;
}

const rankScore = (debt: RankedDebt): number => (debt.iec ?? 0) * (debt.weight ?? 1);

/**
 * Ranking de todas as dívidas (IEC x G), da maior para a menor, com dado insuficiente no fim. Nada é filtrado:
 * o motor, o banco e a matriz mostram as dez dívidas (D10). Empate mantém a ordem de entrada (regra de desempate
 * em aberto, D09).
 */
export function rankAll(debts: RankedDebt[]): RankedDebt[] {
  const known = debts.filter((debt) => debt.iec !== null);
  const unknown = debts.filter((debt) => debt.iec === null);
  return [...known.sort((a, b) => rankScore(b) - rankScore(a)), ...unknown];
}

/**
 * Recorte comercial da Auditoria (D10): as dívidas em vermelho por IEC x G, no máximo 3. É um recorte de entrega,
 * nunca um filtro do motor, do banco ou da matriz, que continuam com as dez dívidas.
 */
export function top3(debts: RankedDebt[]): RankedDebt[] {
  return rankAll(debts.filter((debt) => debt.iec !== null && debt.iec >= 70)).slice(0, 3);
}

/**
 * Alerta por persistência: nenhum alerta antes de 3 ciclos com dados; amarelo ou vermelho só depois de
 * 2 ciclos consecutivos na mesma zona. O alerta azul (interno) depende do limiar da curva logística (v2.0).
 */
export function alertFor(zones: ZoneOrInsufficient[]): "amarelo" | "vermelho" | null {
  if (zones.length < 3) return null;
  const last = zones[zones.length - 1];
  const previous = zones[zones.length - 2];
  if (last !== previous) return null;
  return last === "Vermelha" ? "vermelho" : last === "Amarela" ? "amarelo" : null;
}
