'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const corpus=require('../artifacts/api-server/src/lib/ex04-corpus.generated.json');
const reference=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
const {extractParagraph,extractBlock,canonicalRules}=require('../artifacts/api-server/src/lib/ex04-extraction.cjs');
const source=id=>corpus.sources.find(s=>s.id===id);
test('Exemplos finais dos sete agentes são referências identificadas e alcançáveis; EVL não',()=>{
 for(const id of ['S01','S02','S03','S04','S05','S06','S07']){
  const examples=source(id).referenceBlocks;
  assert.equal(examples.length,1);
  assert.equal(examples[0].kind,'definition_example');
  const text=examples[0].extraction.map(p=>p.referenceText).join(' ');
  const found=reference.retrieve([{role:'user',content:text}],{blocks:examples.map(b=>({...b,source:id,sourceSha256:source(id).sha256}))});
  assert.equal(found.length,1);assert.equal(found[0].kind,'definition_example');
  assert(found[0].text.includes(examples[0].paragraphs[0].ref));
 }
 assert.deepEqual(source('S08').referenceBlocks,[]);
 // These actual queries reach definition examples through the default runtime corpus.
 for(const id of ['S01','S02']){
  const text=source(id).referenceBlocks[0].paragraphs.map(p=>p.text).join(' ');
  assert(reference.retrieve([{role:'user',content:text}]).some(b=>b.source===id&&b.kind==='definition_example'));
 }
});
test('Exemplos não viram definição normativa nem fala passada; orçamento de referências permanece',()=>{
 assert(!reference.definitions.MNT.includes('9. Exemplo'));
 const blocks=reference.retrieve([{role:'user',content:source('S01').referenceBlocks[0].paragraphs.map(p=>p.text).join(' ')}]);
 assert(JSON.stringify(blocks).length<=4800);assert(blocks.length<=3);
 assert(reference.referenceMessage(blocks).content.startsWith('DADOS DE REFERÊNCIA'));
 assert.deepEqual(reference.selectReferences(['S08:example:P0070-P0099'],[]),[]);
});
test('Saída, fronteiras, não sobreposição e revisão final orientam classificação e geração',()=>{
 const classification=reference.classifierAuthority();
 const contract=reference.resolveContract();
 for(const rule of canonicalRules)for(const ref of rule.refs){
  assert(source('S16').paragraphs.some(p=>p.ref===ref));
  assert(classification.includes('S16:'+ref));
  for(const agent of contract.agents)assert(agent.prompt.includes('S16:'+ref));
 }
 for(const text of [classification,...contract.agents.map(a=>a.prompt)]){
  assert(text.includes('Encerre com clareza suficiente'));
  assert(text.includes('Não sobreponha funções centrais'));
  assert(text.includes('Contradição')||text.includes('contradição substantiva'));
  assert(!text.includes('S16:P0103'));assert(!text.includes('S16:P0206'));
  assert(!text.includes('EXERCÍCIO: STRESS TEST'));
 }
});
test('Campos inline e isolados são derivados sem perda dos originais nem slogans no contexto',()=>{
 let inline=0,standalone=0;
 for(const s of corpus.sources)for(const block of s.referenceBlocks)for(const p of block.paragraphs){
  const derived=extractParagraph(p);
  if(p.text.length)assert.equal(derived.fields.map(f=>f.text).join(''),p.text);
  for(const f of derived.fields)assert.equal(p.text.slice(f.start,f.end),f.text);
  assert(!/\b(?:Onboarding|Marketing)\s*:/iu.test(derived.referenceText));
  if(/\b(?:Onboarding|Marketing)\s*:/iu.test(p.text)){
   if(/^(?:Onboarding|Marketing)\s*:/iu.test(p.text))standalone++;
   else inline++;
   const first=p.text.search(/\b(?:Onboarding|Marketing)\s*:/iu);
   assert.equal(derived.referenceText,p.text.slice(0,Math.min(first,p.text.indexOf('→')<0?first:p.text.indexOf('→'))));
  }
  assert.deepEqual(block.extraction,extractBlock(block.paragraphs));
 }
 assert.equal(inline,40);assert(standalone>0);
});
test('Aquisição inline não pontua nem chega à referência exibida; situação numerada continua disponível',()=>{
 const block={id:'mixed',source:'S09',kind:'library_reference',paragraphs:[
  {ref:'P0001',text:'1. (Antes) Decisão complexa sobre orçamento.Onboarding: girassol oceânicoMarketing: foguete violeta→ Dívida | Rótulo'}]};
 assert.deepEqual(reference.retrieve([{role:'user',content:'girassol oceânico foguete violeta'}],{blocks:[block]}),[]);
 const found=reference.retrieve([{role:'user',content:'decisão complexa orçamento'}],{blocks:[block]});
 assert.equal(found.length,1);
 assert(found[0].text.includes('1. (Antes) Decisão'));
 assert(!/girassol|oceânico|foguete|violeta|Dívida/u.test(found[0].text));
 assert.equal(block.paragraphs[0].text.includes('Marketing:'),true);
});
test('Rótulos separados do guia não deixam slogans do parágrafo seguinte entrarem no contexto',()=>{
 const block={id:'guide',source:'S14',paragraphs:[
  {ref:'P1',text:'Situação relevante concreta.'},{ref:'P2',text:'Marketing'},
  {ref:'P3',text:'Foguete violeta sempre resolve.'},{ref:'P4',text:''},
  {ref:'P5',text:'Outra situação pertinente.'}]};
 assert.deepEqual(reference.retrieve([{role:'user',content:'foguete violeta'}],{blocks:[block]}),[]);
 const extracted=extractBlock(block.paragraphs);
 assert.equal(extracted[2].referenceText,'');assert.equal(extracted[2].fieldContext,'standalone_label');
 assert.equal(extracted[4].referenceText,'Outra situação pertinente.');
});
test('450 marcadores = 400 inícios + 50 Top10 numerados, sem afirmar unicidade',()=>{
 const marked=corpus.sources.flatMap(s=>s.paragraphs.filter(p=>/[([](Antes|Durante|Depois|Padrão|Vazio)[)\]]/iu.test(p.text)).map(p=>({source:s.id,...p})));
 const starts=marked.filter(p=>/^[([](Antes|Durante|Depois|Padrão|Vazio)[)\]]/iu.test(p.text));
 const numbered=marked.filter(p=>/^\d+\.\s.*[([](Antes|Durante|Depois|Padrão|Vazio)[)\]]/iu.test(p.text));
 assert.equal(marked.length,450);assert.equal(starts.length,400);assert.equal(numbered.length,50);
 assert.deepEqual(Object.fromEntries(['S09','S10','S11','S12','S15'].map(id=>[id,numbered.filter(p=>p.source===id).length])),
  {S09:10,S10:10,S11:10,S12:10,S15:10});
 for(const p of numbered){
  assert(source(p.source).blocks.some(b=>b.paragraphs.some(x=>x.ref===p.ref&&x.text===p.text)));
  assert(source(p.source).referenceBlocks.some(b=>b.extraction.some(x=>x.ref===p.ref&&x.referenceText.trim())));
 }
});
