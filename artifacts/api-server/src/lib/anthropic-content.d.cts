export function extractAnthropicContent(reply: unknown, options: {mode: 'tool'; toolName: string}): {input: unknown; privateBlocksDiscarded: number};
export function extractAnthropicContent(reply: unknown, options: {mode: 'text'}): {text: string; privateBlocksDiscarded: number};
