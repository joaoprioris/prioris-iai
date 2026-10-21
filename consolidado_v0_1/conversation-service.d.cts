export const NOTICE_VERSION: string;
export class ConversationError extends Error { code: string; status: number; }
export function readAnalysis(value: unknown): any;
export function createConversationService(dependencies: {
 repository: any;
 classify: (input: any) => Promise<unknown>;
 respond: (input: any) => Promise<string|{text:string;progress:any}>;
 agentPrompts: Record<string,string>;
 clock?: () => Date;
}): { turn(scope: {userId:string;organizationId:string}, input: unknown): Promise<any> };
