'use strict';
// Output fidelity checks, never an agent selector or a claim of semantic truth.
const normalize = s => s.toLocaleLowerCase('pt-BR').replace(/[“”"'‘’]/g, '').replace(/\s+/g, ' ').trim();
const { affirmativeHistory } = require('./history-assertions.cjs');
const TIMES = /\b(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?\b|\b(?:hoje|amanhã|agora|imediatamente)\b|\b\d{1,2}(?::\d{2}|h(?:\d{2})?)\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi;
const COMMIT = /\b(?:assum\w*|retorn\w*|volt\w*|confirm\w*|valid\w*|chec\w*|entreg\w*|alinhe|alinhar|alinha)\b/i;
const NAMED_DAYS = /\b(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?\b/gi;
function validateGrounding(value, messages, visibleParts, normalizations = []) {
  const rawClaims = value.operationalClaims ?? [];
  if (!Array.isArray(rawClaims) || rawClaims.length > 12) throw Error('UNSUPPORTED_FACT');
  const claims = [];
  const byRole = { user: messages.filter(m => m.role === 'user'), assistant: messages.filter(m => m.role === 'assistant') };
  for (const claim of rawClaims) {
    if (!claim || !['time_commitment', 'viability', 'impact', 'execution', 'prior_assistant_content'].includes(claim.kind) || !['user', 'assistant'].includes(claim.role) || !Number.isInteger(claim.message) || typeof claim.quote !== 'string' || !claim.quote.trim() || typeof claim.text !== 'string' || !claim.text.trim()) throw Error('UNSUPPORTED_FACT');
    const source = byRole[claim.role][claim.message]?.content;
    if (typeof source !== 'string' || !source.includes(claim.quote)) throw Error('UNSUPPORTED_FACT');
    if (claim.kind === 'prior_assistant_content' && claim.role !== 'assistant') throw Error('UNSUPPORTED_FACT');
    if (claim.kind !== 'prior_assistant_content' && claim.role !== 'user') throw Error('UNSUPPORTED_FACT');
    // A source-verified control field that is not exposed is unused metadata.
    // Omit it, never paraphrase or rewrite its source. Visible assertions below
    // still need their own valid support; this does not certify their meaning.
    if (!visibleParts.some(p => p.includes(claim.text))) {
      normalizations.push({ type: 'unused_operational_claim_omitted', claim: structuredClone(claim) });
      continue;
    }
    claims.push(claim);
  }
  const users = byRole.user.map(m => m.content).join('\n');
  const assistants = byRole.assistant.map(m => m.content).join('\n');
  // Proposed dates are commitments too. Mentioning a date in a question or in
  // a statement of uncertainty is not acceptance/viability of that date.
  for (const part of visibleParts) {
    for (const sentence of part.split(/(?<=[.!?\n])\s*/)) {
      const periods=sentence.match(/\brecentes?\b|\brecentemente\b|(?<![\p{L}\p{N}_])últim(?:os|as)\s+(?:(?:\d+|dois|duas|três|alguns|algumas)\s+)?(?:dias|semanas|meses|anos)\b/giu)??[];
      const temporalHypothesis=sentence.includes('?')||/\b(?:talvez|hipótese|possibilidade)\b|não (?:sei|sabemos) se|sem presumir que/i.test(sentence);
      for(const period of temporalHypothesis?[]:periods){
        const supported=byRole.user.some(m=>m.content.split(/(?<=[.!?;\n])\s*/).some(s=>
          normalize(s).includes(normalize(period))&&!/\b(?:não|talvez|hipótese|se)\b|\?/i.test(s)));
        if(!supported)throw Error('UNSUPPORTED_FACT');
      }
      // Two recent reports are not necessarily the last two reports.
      const recency = sentence.match(/(?:^|\s)últim(?:os|as)\s+(?:dois|duas|2)\s+(relatórios|entregas)\b/i);
      if (recency && !sentence.includes('?')) {
        const supported = byRole.user.some(m => m.content.split(/(?<=[.!?\n])\s*/).some(s => {
          const match = s.match(/(?:^|\s)últim(?:os|as)\s+(?:dois|duas|2)\s+(relatórios|entregas)\b/i);
          return match && match[1].toLowerCase() === recency[1].toLowerCase() && !/\b(?:não|talvez|hipótese)\b|não sei/i.test(s);
        }));
        if (!supported) throw Error('UNSUPPORTED_FACT');
      }
      // A relative date does not establish a named weekday. Preserve the leader's
      // wording; questions/hypotheses and ordinal uses are not calendar assertions.
      if (!sentence.includes('?') && !/\b(?:se|caso|hipótese|possibilidade)\b|não sei|não sabemos/i.test(sentence)) {
        for (const day of sentence.match(NAMED_DAYS) ?? []) {
          const ordinal = new RegExp('\\b' + day + '\\s+(?:opção|alternativa|vez|parte|etapa|entrega|pergunta|resposta|proposta|pessoa|equipe|tentativa|condição|questão|passo|ponto|parcela|fase)\\b', 'i');
          if (!ordinal.test(sentence) && !new RegExp('\\b' + day + '\\b', 'i').test(users)) throw Error('UNSUPPORTED_FACT');
        }
      }
      if (/\b(?:prazo|data)s?\b/i.test(sentence) && /\b(?:qual|que)\b/i.test(sentence) && /(?:prefere|preferem|funciona melhor|mais conveniente)/i.test(sentence) && !claims.some(c => c.kind === 'viability' && sentence.includes(c.text) && /\b(?:viáveis|viável|confirmadas|confirmados)\b/i.test(c.quote) && !/\b(?:não|sem|talvez)\b/i.test(c.quote))) throw Error('UNSUPPORTED_FACT');
      const times = sentence.match(TIMES) ?? [];
      if (COMMIT.test(sentence) && times.length) {
        const supported = claims.some(c => c.kind === 'time_commitment' && sentence.includes(c.text) && times.every(t => normalize(c.quote).includes(normalize(t))) && /\b(?:posso|consigo|vou|assumo|assumi|combinamos|confirmamos|me comprometo)\b/i.test(c.quote) && !/\b(?:não|sem|talvez|se)\b/i.test(c.quote));
        if (!supported) throw Error('UNSUPPORTED_FACT');
      }
      if (affirmativeHistory(sentence) && /prazo que voc[eê] assumiu|voc[eê] (?:assumiu|aceitou|confirmou|validou|executou|já alinhou)\b/i.test(sentence) && !claims.some(c => c.kind === 'execution' && sentence.includes(c.text) && users.includes(c.quote))) throw Error('UNSUPPORTED_FACT');
      if (affirmativeHistory(sentence) && /\b(?:ofereci|apresentei|mostrei|sugeri|frases oferecidas|opções (?:oferecidas|anteriores))\b/i.test(sentence)) {
        const supporting = claims.filter(c => c.kind === 'prior_assistant_content' && sentence.includes(c.text) && assistants.includes(c.quote));
        if (!supporting.length) throw Error('UNSUPPORTED_FACT');
        if (/\bduas\b/i.test(sentence) && new Set(supporting.map(c => c.quote)).size < 2) throw Error('UNSUPPORTED_FACT');
      }
    }
  }
  return structuredClone(claims);
}
function rejectDuplicateDelivery(parts, delivery) {
  if (!delivery) return;
  const target = normalize(delivery);
  if (parts.some(p => normalize(p).includes(target))) throw Error('DUPLICATE_DELIVERY');
}
module.exports = { validateGrounding, rejectDuplicateDelivery };
