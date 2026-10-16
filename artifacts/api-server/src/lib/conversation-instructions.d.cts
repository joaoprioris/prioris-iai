export const COMMON_RESPONSE: string;
export const SUPPORT_PROTOCOL: string;
export const REPAIR_BOUNDARY: string;
export const EXAMPLE_REPAIR_SYSTEM: string;
export function applyExampleRepair(candidate: any, edited: any): { candidate: any; normalizations: any[] };
export function responseInstructions(agent: string): string;
export function repairData(candidate: any, code: string, reason: string, presentation?: any): any;
