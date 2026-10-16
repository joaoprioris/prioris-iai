export const COMMON_RESPONSE: string;
export const CONVERSATION_REVISION: string;
export const SUPPORT_PROTOCOL: string;
export const REPAIR_BOUNDARY: string;
export const EXAMPLE_REPAIR_SYSTEM: string;
export const EXAMPLE_COMPOSITION_REPAIR_SYSTEM: string;
export function applyExampleRepair(candidate: any, edited: any, recompose?: boolean): { candidate: any; normalizations: any[] };
export function responseInstructions(agent: string): string;
export function repairData(candidate: any, code: string, reason: string, presentation?: any, messages?: any[]): any;
