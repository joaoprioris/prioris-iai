export const REVISION: string;
export const MAX_REFERENCE_CHARS: number;
export function resolveContract(contract?: any): any;
export function retrieve(messages?: any[], options?: any): any[];
export function selectReferences(requested: unknown, messages: any[]): any[];
export function referenceMessage(blocks: any[]): {role: "user"; content: string} | null;
export function classifierAuthority(): string;
export function canonicalExample(agent: string): string;
export function feedbackReferenceInventory(): {
  supportExamples: Array<{id:string;source:string;sourceSha256:string;kind:'support_example';refs:string[]}>;
  evaluationCases: Array<{id:string;source:string;sourceSha256:string;kind:'evaluation_case';refs:string[]}>;
};
