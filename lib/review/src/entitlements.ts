/**
 * Habilitação por contrato. A coleta (ingestão) e o Risk Engine rodam para todo cliente, sempre: o motor calcula
 * e acumula o histórico mesmo quando o cliente não sabe que ele existe. O que o contrato controla é o que o
 * cliente enxerga: o módulo (`creClientVisible`) e os alertas dirigidos ao RH (`alertsEnabled`). Os sinalizadores
 * são definidos por administrador (nunca pelo cliente). Política comercial (prazos, gratuidade, o que acontece
 * depois dos 6 meses) fica fora deste código e entra aqui apenas como dado.
 */
export interface Entitlement {
  contractMonths: 6 | 12;
  creClientVisible: boolean;
  alertsEnabled: boolean;
}

/** O motor roda sempre, com ou sem registro de habilitação. */
export const engineMayRun = (_entitlement: Entitlement | null | undefined): boolean => true;

/** O cliente só enxerga saídas do Risk Engine (painel, matriz, IEC) quando o contrato torna o módulo visível. */
export const clientMaySeeEngine = (entitlement: Entitlement | null | undefined): boolean =>
  entitlement?.creClientVisible === true;

/** Alerta dirigido ao cliente exige o módulo visível e o alerta habilitado. Alerta azul é interno e não passa por aqui. */
export const alertsMayRun = (entitlement: Entitlement | null | undefined): boolean =>
  entitlement?.creClientVisible === true && entitlement.alertsEnabled === true;
