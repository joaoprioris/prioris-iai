/**
 * Maturidade da leitura N0 a N4. Fontes: Mestre (bloco 8) e Manual de Auditoria (2.2 e 2.3), que prevalecem
 * sobre a tabela de densidade anterior no que toca ao tempo:
 * - N2 (direcional) exige 3 meses ou mais; N3 (confiável) exige 6 meses ou mais; N4 exige IEC estável;
 * - N2 ou mais exige taxa de resposta de 35% ou mais e persistência em 2 ciclos consecutivos ou mais;
 * - o nível é o menor entre volume, líderes ativos e tempo (a âncora de volume é o limite inferior da faixa);
 * - líderes ativos: <20% N0, <30% N1, <40% N2, <50% N3, 50% ou mais N4.
 * "Estabilidade do IEC" ainda não tem critério numérico em nenhum documento: entra como indicador informado.
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

export const MIN_RESPONSE_RATE = 0.35;
export const MIN_CONSECUTIVE_CYCLES = 2;

export const anchorFor = (leaders: number): number =>
  ANCHORS.find((anchor) => leaders <= anchor.maxLeaders)!.minEvents;

export interface MaturityInput {
  eventsPerMonth: number;
  leaders: number;
  activeLeaderShare: number;
  stableMonths: number;
  /** Taxa de resposta do grupo elegível, de 0 a 1. */
  responseRate: number;
  /** Ciclos consecutivos com o padrão presente. */
  consecutiveCycles: number;
  /** IEC estável ao longo dos ciclos (critério a definir pelo proprietário). */
  iecStable: boolean;
}

export function maturity(input: MaturityInput): Maturity {
  const ratio = input.eventsPerMonth / anchorFor(input.leaders);
  const byVolume: Maturity = ratio < 0.5 ? 0 : ratio < 1 ? 1 : ratio < 1.5 ? 2 : ratio <= 3 ? 3 : 4;
  const share = input.activeLeaderShare;
  const byActive: Maturity = share < 0.2 ? 0 : share < 0.3 ? 1 : share < 0.4 ? 2 : share < 0.5 ? 3 : 4;
  const months = input.stableMonths;
  const byTime: Maturity = months < 3 ? 1 : months < 6 ? 2 : input.iecStable ? 4 : 3;
  const level = Math.min(byVolume, byActive, byTime) as Maturity;
  const qualityOk = input.responseRate >= MIN_RESPONSE_RATE && input.consecutiveCycles >= MIN_CONSECUTIVE_CYCLES;
  return !qualityOk && level > 1 ? 1 : level;
}

export const isReportable = (level: Maturity): boolean => level >= 2;
