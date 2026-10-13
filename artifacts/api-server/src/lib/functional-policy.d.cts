export const ROUTING_VERSION: string;
export function readRisk(analysis:any,messages?:any[]):{verified:boolean;kind:string;basis:string;evidence:string|null;impactEvidence:string|null};
export const AGENTS: readonly string[];
export const JOBS: readonly string[];
export const SITUATION_STATES: readonly string[];
export function decideRoute(analysis: any, trustedContext?: any, previousAgent?: string | null): any;
export function readSituation(analysis: any, messages?: {role: string; content: string}[]): {state: string | null; evidence: string | null};
