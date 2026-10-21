'use strict';

const PRIVATE_BLOCKS = new Set(['thinking', 'redacted_thinking']);

function extractAnthropicContent(reply, options = {}) {
  const mode = options.mode ?? 'tool';
  if (!reply || !Array.isArray(reply.content) || !['tool', 'text'].includes(mode)) throw Error('UNEXPECTED_CONTENT');
  const publicBlocks = [];
  for (const block of reply.content) {
    if (!block || typeof block.type !== 'string') throw Error('UNEXPECTED_CONTENT');
    if (PRIVATE_BLOCKS.has(block.type)) continue;
    if (mode === 'text' && block.type === 'text' && typeof block.text === 'string') {
      publicBlocks.push(block);
      continue;
    }
    if (mode === 'tool' && block.type === 'tool_use' && block.name === options.toolName) {
      publicBlocks.push(block);
      continue;
    }
    throw Error('UNEXPECTED_CONTENT');
  }
  if (mode === 'text') {
    if (!publicBlocks.length) throw Error('UNEXPECTED_CONTENT');
    return { text: publicBlocks.map(block => block.text).join('\n'), privateBlocksDiscarded: reply.content.length - publicBlocks.length };
  }
  if (publicBlocks.length !== 1) throw Error('UNEXPECTED_CONTENT');
  return { input: publicBlocks[0].input, privateBlocksDiscarded: reply.content.length - 1 };
}

module.exports = { extractAnthropicContent };
