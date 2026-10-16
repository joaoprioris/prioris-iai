export const REVISION: string;
export const MAX_REFERENCE_CHARS: number;
export function resolveContract(contract?: any): any;
export function retrieve(messages?: any[], options?: any): any[];
export function selectReferences(requested: unknown, messages: any[]): any[];
export function referenceMessage(blocks: any[]): {role: "user"; content: string} | null;
export function classifierAuthority(): string;
export function canonicalExample(agent: string): string;
