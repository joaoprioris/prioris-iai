/**
 * Habilitação por contrato. A coleta (ingestão) funciona sempre; o consumo dos agregados pelo Cultural Risk
 * Engine e a emissão de alertas dependem destes sinalizadores, definidos por administrador (nunca pelo cliente).
 * Regra comercial (proprietário): o Risk Engine fica habilitado por 6 meses quando o cliente fecha contrato
 * de 12 meses. O que acontece depois disso é decisão comercial e entra aqui como dado, não como regra de código.
 */
export interface Entitlement {
  contractMonths: 6 | 12;
  creEnabled: boolean;
  alertsEnabled: boolean;
}

export const engineMayRun = (entitlement: Entitlement | null | undefined): boolean => entitlement?.creEnabled === true;

/** Alerta exige o Risk Engine habilitado. */
export const alertsMayRun = (entitlement: Entitlement | null | undefined): boolean =>
  entitlement?.creEnabled === true && entitlement.alertsEnabled === true;
