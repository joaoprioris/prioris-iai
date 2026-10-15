'use strict';
// Reproducible data compiler, not a model call. Evaluation cases are never input.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {extractBlock,canonicalRules}=require('../artifacts/api-server/src/lib/ex04-extraction.cjs');
const input = path.resolve('generated-artifacts/ex04-input/FONTES_CANONICAS.json');
const output = path.resolve('artifacts/api-server/src/lib/ex04-corpus.generated.json');
const source = JSON.parse(fs.readFileSync(input, 'utf8'));
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
if (source.sources.length !== 17 || source.sources.reduce((n,s)=>n+s.paragraphs.length,0)!==3141)
  throw Error('EX04_SOURCE_COUNTS_CHANGED_REVIEW_REQUIRED');
const libraryIds = new Set(['S09','S10','S11','S12','S13','S14','S15']);
const state = /^[([](Antes|Durante|Depois|Padrão|Vazio)[)\]]/iu;
const heading = /^(?:BLOCO\s+\d|Top\s+\d|\d+\.\s|CUSTO\s|Agente\s|AGENTE\s)/iu;
const sources = source.sources.map(s => {
  const blocks = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    blocks.push({id:`${s.id}:${current[0].ref}-${current.at(-1).ref}`,
      paragraphs:current, kind:state.test(current[0].text.trim())?'moment':'context'});
    current=[];
  };
  // Keep every paragraph, including empty ones, exactly once and in source order.
  // A moment and its onboarding/marketing variants remain in the same block.
  for (const p of s.paragraphs) {
    if (current.length && (state.test(p.text.trim()) || heading.test(p.text.trim()))) flush();
    current.push(p);
  }
  flush();
  const exampleStart=s.paragraphs.findIndex(p=>/^9\.\s/u.test(p.text.trim()));
  const referenceBlocks=libraryIds.has(s.id)?blocks.map(b=>({...b,kind:'library_reference'})):
    Number(s.id.slice(1))<=7&&exampleStart>=0
      ?[{id:`${s.id}:example:${s.paragraphs[exampleStart].ref}-${s.paragraphs.at(-1).ref}`,
        kind:'definition_example',paragraphs:s.paragraphs.slice(exampleStart)}]:[];
  return {...s, role:libraryIds.has(s.id)?'library':Number(s.id.slice(1))<=8?'definition':'principles', blocks,
    referenceBlocks:referenceBlocks.map(b=>({...b,extraction:extractBlock(b.paragraphs)}))};
});
const canonical=sources.find(s=>s.id==='S16');
for(const rule of canonicalRules)for(const ref of rule.refs)
  if(!canonical.paragraphs.some(p=>p.ref===ref&&p.text.trim()))throw Error('EX04_CANONICAL_REFERENCE_MISSING');
const corpus = {revision:'EX04-2', inputSha256:sha(fs.readFileSync(input)),
  authority:source.authority, approvedDecisions:source.approved_decisions, sources};
fs.writeFileSync(output,JSON.stringify(corpus,null,2)+'\n');
const counts = sources.map(s=>({id:s.id,path:s.path,sha256:s.sha256,paragraphs:s.paragraphs.length,
  nonempty:s.paragraphs.filter(p=>p.text.trim()).length,blocks:s.blocks.length,
  explicitStateMoments:s.blocks.filter(b=>b.kind==='moment').length,
  markedParagraphs:s.paragraphs.filter(p=>/[([](Antes|Durante|Depois|Padrão|Vazio)[)\]]/iu.test(p.text)).map(p=>p.ref),
  numberedMarkedParagraphs:s.paragraphs.filter(p=>/^\d+\.\s.*[([](Antes|Durante|Depois|Padrão|Vazio)[)\]]/iu.test(p.text)).map(p=>p.ref),
  definitionExamples:s.referenceBlocks.filter(b=>b.kind==='definition_example').length,
  numberedHeadings:s.paragraphs.filter(p=>/^\d+\./u.test(p.text.trim())).map(p=>p.ref)}));
fs.mkdirSync('generated-artifacts/ex04-2',{recursive:true});
fs.writeFileSync('generated-artifacts/ex04-2/catalog-counts.json',JSON.stringify({
  revision:corpus.revision,totalSources:sources.length,totalParagraphs:3141,
  counts,ambiguities:[
    'Explicit-state counts are occurrences, not deduplicated unique moments; numbered/top lists are preserved separately.',
    'S13 repeats BLOCO 3 and restarts numbering; all occurrences and original paragraph references are retained.',
    'S14 includes conversion/onboarding/acquisition guidance, not only conversational examples.',
    'Marketing assertions and old imperative examples are reference material, not facts or current response instructions.',
    'Validation references use L identifiers; the transferred runtime sources use S identifiers. No unprovided L-to-S mapping is invented.',
    'D01-D03 and current definitions govern tensions with library imperatives; EVL is documented but not enabled.'
  ]},null,2)+'\n');
console.log(JSON.stringify({revision:corpus.revision,sources:sources.length,paragraphs:3141,
  output,sha256:sha(fs.readFileSync(output))}));
