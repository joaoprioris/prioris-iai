/**
 * Maturidade da leitura N0 a N4 (Dossiê, Parte 10). Interpretação adotada, a confirmar pelo dono:
 * - o âncora de volume é o limite inferior da faixa da tabela de densidade;
 * - o nível é o menor entre os três vetores (volume, líderes ativos, tempo);
 * - líderes ativos: <20% N0, <30% N1, <40% N2, <50% N3, 50% ou mais N4;
 * - tempo estável: <1 mês N1, 1 a 2 meses N2, 3 a 5 meses N3, 6 meses ou mais N4.
 * Abaixo de N2 não há relatório: "indisponível por maturidade" (a ausência de dado é dado).
 */
export type Maturity = 0 | 1 | 2 | 3 | 4;

const ANCHORS: { maxLeaders: number; minEvents: number }[] = [
  { maxLeaders: 10, minEvents: 40 },
  { maxLeaders: 50, minEvents: 120 },
  { maxLeaders: 100, minEvents: 250 },
  { maxLeaders: 300, minEvents: 600 },
  { maxLeaders: 500, minEvents: 1200 },
  { maxLeaders: 1000, minEvents: 2500 },
  { maxLeaders: Infinity, minEvents: 5000 },
];

export const anchorFor = (leaders: number): number =>
  ANCHORS.find((anchor) => leaders <= anchor.maxLeaders)!.minEvents;

export interface MaturityInput {
  eventsPerMonth: number;
  leaders: number;
  activeLeaderShare: number;
  stableMonths: number;
}

export function maturity(input: MaturityInput): Maturity {
  const ratio = input.eventsPerMonth / anchorFor(input.leaders);
  const byVolume: Maturity = ratio < 0.5 ? 0 : ratio < 1 ? 1 : ratio < 1.5 ? 2 : ratio <= 3 ? 3 : 4;
  const share = input.activeLeaderShare;
  const byActive: Maturity = share < 0.2 ? 0 : share < 0.3 ? 1 : share < 0.4 ? 2 : share < 0.5 ? 3 : 4;
  const months = input.stableMonths;
  const byTime: Maturity = months < 1 ? 1 : months < 3 ? 2 : months < 6 ? 3 : 4;
  return Math.min(byVolume, byActive, byTime) as Maturity;
}

export const isReportable = (level: Maturity): boolean => level >= 2;
