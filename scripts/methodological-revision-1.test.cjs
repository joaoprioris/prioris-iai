'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {validateMethodologicalFidelity}=require('../artifacts/api-server/src/lib/methodological-fidelity.cjs');
const contract=require('../artifacts/api-server/src/lib/agent-contract.json');
const original=JSON.parse(fs.readFileSync('generated-artifacts/pilot-methodology-revision-1/state-before.json'));
const profiles=Object.fromEntries(contract.agents.map(p=>[p.id,p]));
const envelope=(agent,extra={})=>({text:'O fato relatado ainda não identifica a mudança esperada; a lacuna é distinguir o observado da interpretação. Como você pretende abordar esse ponto?',stage:'explore',
 completed:[],pending:profiles[agent].diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',
 operationalClaims:[],authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''},...extra});
const user=content=>({role:'user',content});
test('Rodada17: fala pronta sem elaboração anterior é recusada; fala posterior não é fonte retroativa',()=>{
 const r=original.archivedRounds.find(a=>a.round===17).original;
 const t=r.audit.find(a=>a.turn===2&&a.outcome==='completed');
 const candidate=structuredClone(t.generationAttempts.at(-1).input);
 assert.throws(()=>validateProgress(candidate,profiles.OTO,t.messages,{number:2}),/AUTONOMY_CONSTRAINT_FAILED/);
 const forged={...candidate,authorship:{supportMode:'optional_example',approachEvidence:[{message:5,quote:'Vou esperar um pouco.'}],examplePurpose:'Revisar a abertura elaborada.'}};
 assert.throws(()=>validateProgress(forged,profiles.OTO,t.messages,{number:2}),/INVALID_PROGRESS_EVIDENCE/);
});
test('Rodada17: processamento não permite excluir evasão; hipótese aberta é permitida',()=>{
 const messages=[user('Ela ficou em silêncio por alguns segundos. Acho que vou esperar.')];
 assert.throws(()=>validateMethodologicalFidelity({},messages,['O silêncio pode ser processamento, não evasão.']),/UNSUPPORTED_FACT/);
 const v=envelope('OTO',{text:'O silêncio admite diferentes leituras; processamento ou evasão são hipóteses, não fatos confirmados. Sua escolha é esperar; falta observar a resposta.'});
 assert.equal(validateProgress(v,profiles.OTO,messages,{number:5}).progress.methodologyRevision,require('../artifacts/api-server/src/lib/methodological-fidelity.cjs').REVISION);
});
test('Rodada18: efeitos e incapacidade sem relato anterior são recusados em cada prefixo real',()=>{
 const r=original.archivedRounds.find(a=>a.round===18).original;
 for(const turn of [1,2,3]){
  const t=r.audit.find(a=>a.turn===turn&&a.outcome==='completed');
  const v=structuredClone(t.generationAttempts.at(-1).input);
  v.authorship={supportMode:'explore',approachEvidence:[],examplePurpose:''};
  assert.throws(()=>validateProgress(v,profiles[t.route.agent],t.messages,{number:turn}),/UNSUPPORTED_FACT/);
 }
});
test('Intenção, condição, pergunta, receio e fonte do assistente não comprovam resultado',()=>{
 const text='Isso preserva o acordo.';
 for(const messages of [[user('Quero que isso preserve o acordo.')],[user('Se isso preserva o acordo, eu aceito.')],
 [user('Receio que isso preserva o acordo só por um momento.')],[{role:'assistant',content:text}]]){
  const c={kind:'impact',role:'user',message:0,quote:messages[0].content,text};
  assert.throws(()=>validateMethodologicalFidelity({operationalClaims:[c]},messages,[text]),/UNSUPPORTED_FACT/);
 }
});
test('Efeito explicitamente relatado pode ser retomado com referência exata nas funções pertinentes',()=>{
 const quote='Essa reação protegeu o momento.';
 for(const agent of ['CTN','MNT','IMP','OTO','FBK']){
  const v=envelope(agent,{text:quote,operationalClaims:[{kind:'impact',role:'user',message:0,quote,text:quote}]});
  assert.equal(validateProgress(v,profiles[agent],[user(quote)],{number:2}).text,quote);
 }
});
test('Incapacidade relatada é permitida; desejo de reduzir escopo não a comprova',()=>{
 const quote='A equipe não tem condição de cumprir.';
 const v=envelope('OTO',{text:quote,operationalClaims:[{kind:'viability',role:'user',message:0,quote,text:quote}]});
 assert.equal(validateProgress(v,profiles.OTO,[user(quote)],{number:3}).text,quote);
 const source='Quero combinar o que sai do escopo para a equipe conseguir cumprir.';
 assert.throws(()=>validateProgress({...v,operationalClaims:[{kind:'viability',role:'user',message:0,quote:source,text:quote}]},profiles.OTO,[user(source)],{number:3}),/UNSUPPORTED_FACT/);
});
test('Hipóteses identificadas não são proibidas nem transformadas em resultados',()=>{
 for(const text of ['É uma hipótese: isso preserva o acordo; o efeito ainda não foi observado.',
 'Talvez essa reação proteja o momento; não sabemos o efeito.',
 'A hipótese é que a equipe não tem condição de cumprir; falta verificar capacidade.']){
  assert.equal(validateProgress(envelope('OTO',{text}),profiles.OTO,[user('Ainda não conheço esses efeitos.')],{number:2}).text,text);
 }
});
test('Exemplo opcional revisa abordagem existente em Feedback e 1:1, sem duplicação',()=>{
 const source='Eu perguntaria como ela vê esse episódio antes de propor uma mudança.';
 for(const agent of ['FBK','OTO']){
  const v=envelope(agent,{text:'Você elaborou uma pergunta antes de propor mudança. A revisão pode manter o foco no episódio, sem atribuir causa.',
   delivery:{kind:agent==='FBK'?'message':'micro_move',text:'Como você vê esse episódio?'},
   authorship:{supportMode:'optional_example',approachEvidence:[{message:0,quote:source}],examplePurpose:'Revisar pontualmente a pergunta já elaborada pelo líder.'}});
  const out=validateProgress(v,profiles[agent],[user(source)],{number:2});
  assert.equal(out.text.split(v.delivery.text).length-1,1);
  assert.match(out.text,/Exemplo opcional/);
  assert.equal(out.progress.authorship.supportMode,'optional_example');
 }
});
test('Descrição do problema não vira elaboração; receita não pode ficar escondida no texto',()=>{
 const source='Estou recebendo um feedback indireto sem exemplo concreto.';
 const v=envelope('OTO',{delivery:{kind:'micro_move',text:'Me dê um exemplo.'},
  authorship:{supportMode:'optional_example',approachEvidence:[{message:0,quote:source}],examplePurpose:'Revisar uma abordagem.'}});
 assert.throws(()=>validateProgress(v,profiles.OTO,[user(source)],{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
 assert.throws(()=>validateProgress(envelope('OTO',{text:'Diga essa frase e encerre a conversa.'}),profiles.OTO,[user(source)],{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Negação e hipótese anteriores não sustentam afirmação de incapacidade',()=>{
 const quote='A equipe não tem condição de cumprir.';
 const text=quote;
 for(const source of ['Não afirmei que '+quote,'Talvez '+quote]){
  assert.throws(()=>validateMethodologicalFidelity({operationalClaims:[{kind:'viability',role:'user',message:0,quote,text}]},[user(source)],[text]),/UNSUPPORTED_FACT/);
 }
});
const requireApi=Module.createRequire(path.resolve('artifacts/api-server/package.json'));
const built=requireApi('esbuild').buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
const m=new Module(path.resolve('artifacts/api-server/fixture-methodological.cjs'),module);
m.filename=path.resolve('artifacts/api-server/fixture-methodological.cjs');m.paths=Module._nodeModulePaths(path.dirname(m.filename));m._compile(built.outputFiles[0].text,m.filename);
test('Geração simulada recusa fórmula e aceita elaboração concreta no reparo; não é busca de palavras no prompt',async()=>{
 const candidates=[envelope('OTO',{text:'Diga essa frase para encerrar.',delivery:{kind:'micro_move',text:'Me dê um exemplo.'}}),
 envelope('OTO',{text:'O pedido ainda não aponta uma mudança observável. Há uma diferença entre pedir um exemplo e assumir uma causa; o exemplo pode ajudar a examinar o que ela observou. Como você pretende buscar essa distinção?'})];
 let calls=0;const codes=[];
 const providers=m.exports.createModelProviders({client:{messages:{create:async p=>{calls++;return {stop_reason:'tool_use',content:[{type:'tool_use',name:p.tool_choice.name,input:candidates.shift()}]};}}},
 onValidationObservation:e=>codes.push(e.code)});
 const out=await providers.respond({agent:'OTO',system:profiles.OTO.prompt,messages:[user('Ela fala comigo agora, mas não trouxe um exemplo.')],history:[],turn:{number:2,max:10}});
 assert.equal(calls,2);assert(codes.includes('AUTONOMY_CONSTRAINT_FAILED'));
 assert.match(out.text,/mudança observável/);assert.equal(out.progress.authorship.supportMode,'explore');
});
test('Contingência simulada não pergunta novamente sobre contexto já informado',async()=>{
 const candidates=[envelope('OTO',{text:'Uma pergunta? Outra pergunta? Mais uma pergunta?'}),envelope('OTO',{text:'Uma pergunta? Outra pergunta? Mais uma pergunta?'})];
 const providers=m.exports.createModelProviders({client:{messages:{create:async p=>({stop_reason:'tool_use',content:[{type:'tool_use',name:p.tool_choice.name,input:candidates.shift()}]})}}});
 const source='A conversa está acontecendo agora; ainda não recebi um exemplo.';
 const out=await providers.respond({agent:'OTO',system:profiles.OTO.prompt,messages:[user(source)],history:[],turn:{number:3,max:10}});
 assert(out.text.includes(source));assert.doesNotMatch(out.text,/O que está acontecendo|em qual ponto você precisa/);
 assert.match(out.progress.evidenceStatus,/Recovery/);
});
test('Continuidade entre agentes mantém contagem; risco físico relatado conserva proteção necessária',async()=>{
 const {createPilotStore}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {pilotIdentity}=require('../artifacts/api-server/src/lib/pilot-next-round.cjs');
 const identity=pilotIdentity(19),scope={userId:identity.id,organizationId:identity.organizationId};
 const s={round:19,requests:{},audit:[],budget:{calls:[]}};
 const store=createPilotStore(s,()=>{},identity),session=store.open(scope);
 const observations=[
 {scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true},
 {scope:'leadership',job:'prepare_message',confidence:'high',conversationInProgress:false,decisionSufficientlyClear:true},
 {scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true,immediateExternalRisk:true,riskKind:'physical',riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:'Ele está me ameaçando com uma faca',riskImpactEvidence:'Ele está me ameaçando com uma faca'}];
 const service=createConversationService({repository:store.repository,classify:async()=>observations.shift(),
 respond:async p=>validateProgress(envelope(p.agent),profiles[p.agent],p.messages,p.turn),
 agentPrompts:Object.fromEntries(contract.agents.map(p=>[p.id,p.prompt]))});
 const first=await service.turn(scope,{sessionId:session.id,requestId:'first-fictitious',content:'Ela fala comigo agora; preciso entender o que espera.'});
 const second=await service.turn(scope,{sessionId:session.id,requestId:'second-fictitious',content:'Agora preparo uma conversa futura; quero falar sobre o retrabalho.'});
 assert.equal(first.exchangeCount,1);assert.equal(second.exchangeCount,2);assert.equal(first.route.agent,'OTO');assert.equal(second.route.agent,'FBK');
 const risk=await service.turn(scope,{sessionId:session.id,requestId:'third-fictitious',content:'Ele está me ameaçando com uma faca'});
 assert.equal(risk.route.agent,'CRS');assert.match(risk.text,/segurança|integridade física/);assert.equal(risk.exchangeCount,3);
});
