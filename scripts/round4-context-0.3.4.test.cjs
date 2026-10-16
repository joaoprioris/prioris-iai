'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const original=JSON.parse(fs.readFileSync('generated-artifacts/pilot-0.3.3-round-4-preserved/state.original.json'));
const {decideRoute,readSituation,ROUTING_VERSION}=require('../artifacts/api-server/src/lib/functional-policy.cjs');
const {readFunctionalNeed,focalQuestion}=require('../artifacts/api-server/src/lib/functional-context.cjs');
const {validateGrounding}=require('../artifacts/api-server/src/lib/response-grounding.cjs');
const {prepareFifthRound,FIFTH_IDENTITY,FOURTH_IDENTITY}=require('../artifacts/api-server/src/lib/pilot-rounds.cjs');
const {createPilotStore}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const contract=require('../artifacts/api-server/src/lib/agent-contract.json');
const profile=contract.agents.find(a=>a.id==='FBK'),prompts=Object.fromEntries(contract.agents.map(a=>[a.id,a.prompt]));
const t=original.audit.filter(a=>a.turn<=4);
const built=require(path.resolve('artifacts/api-server/node_modules/esbuild')).buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
const filename=path.resolve('artifacts/api-server/isolated-round4-adapter.cjs'),mod=new Module(filename,module);
mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(built.outputFiles[0].text,filename);
function provider(values,events=[],payloads=[]){
 return mod.exports.createModelProviders({onValidationObservation:e=>events.push(e),client:{messages:{create:async p=>{
  payloads.push(p);return {stop_reason:'tool_use',content:[{type:'tool_use',name:p.tool_choice.name,input:structuredClone(values.shift())}],usage:{input_tokens:10,output_tokens:10}};
 }}}});
}
const supportive={...t[3].generationAttempts[1].input,
 text:'Você já nomeou as inconsistências e o retrabalho; querer preservar a confiança não apaga esses fatos. Ainda não sabemos a causa. Que mudança você quer construir ao abordar isso?',
 authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''}};
test('Replay das classificações arquivadas: T1 esclarece momento; T2 entra no Feedback; T3 preserva necessidade sem menu',()=>{
 let previous=null;const routes=[];
 for(const a of t){routes.push(decideRoute(a.analysis,{reportedMessages:a.messages,functionalNeed:previous}));previous=readFunctionalNeed(a.analysis,a.messages,previous);}
 assert.deepEqual(routes.map(r=>[r.mode,r.agent]),[['clarify',null],['agent','FBK'],['agent','FBK'],['agent','FBK']]);
 assert.equal(routes[2].reason,'message_preparation_context_preserved');
 assert.equal(t[2].analysis.job,'compare_paths');assert.equal(t[2].analysis.confidence,'moderate');
 assert.equal(readFunctionalNeed(t[0].analysis,t[0].messages).established,false);
});
test('Moderação com necessidade citada aceita mudança real; decisão substantiva não é confundida com abordagem',()=>{
 const prior=readFunctionalNeed(t[1].analysis,t[1].messages);
 const messages=[...t[2].messages,{role:'user',content:'Ainda preciso decidir se corrijo o relatório ou suspendo a entrega.'}];
 const a={...t[2].analysis,needEvidence:[{message:3,quote:'decidir se corrijo o relatório ou suspendo a entrega'}],substantiveDecisionPending:true,decisionEvidence:[{message:3,quote:'decidir se corrijo o relatório ou suspendo a entrega'}]};
 assert.equal(decideRoute(a,{reportedMessages:messages,functionalNeed:prior}).agent,'MNT');
 const grounded=readFunctionalNeed(a,messages,prior);
 const reused=readFunctionalNeed({...a,needEvidence:[]},messages,grounded);
 assert.equal(reused.inherited,true);assert.equal(reused.confidence,'moderate');
 assert.equal(decideRoute({...a,needEvidence:[]},{reportedMessages:messages,functionalNeed:grounded}).agent,'MNT');
 const pending=decideRoute({...a,job:'prepare_message',confidence:'high'},{reportedMessages:messages,functionalNeed:prior});
 assert.equal(pending.reason,'substantive_decision_pending');assert.equal(pending.agent,null);
 assert.equal(decideRoute({...a,job:'prepare_message',confidence:'high',decisionEvidence:[]},{reportedMessages:messages,functionalNeed:prior}).agent,'FBK');
 const missing=decideRoute({...a,job:'unclear',confidence:'low',clarificationQuestion:'Qual informação sobre essa decisão ainda falta?'},{reportedMessages:messages,functionalNeed:prior});
 assert.equal(missing.mode,'clarify');assert.equal(missing.question,'Qual informação sobre essa decisão ainda falta?');
});
test('Risco real, capacidade e fronteiras prevalecem; nome/estado e palavra isolada não selecionam Feedback ou 1:1',()=>{
 const base=t[1].analysis,prior=readFunctionalNeed(base,t[1].messages);
 const danger='Ele está ameaçando atacar a equipe com uma faca agora.',messages=[...t[1].messages,{role:'user',content:danger}];
 assert.equal(decideRoute({...base,immediateExternalRisk:true,riskKind:'physical',riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:danger,riskImpactEvidence:danger},{reportedMessages:messages,functionalNeed:prior}).agent,'CRS');
 const reaction='Estou tão abalado que não consigo pensar com clareza.';
 const current=[...messages,{role:'user',content:reaction}];
 assert.equal(decideRoute({...base,ownClarityImpaired:true,ownClarityBasis:'reaction_or_overload_impeding_judgment',ownClarityEvidence:reaction},{reportedMessages:current,functionalNeed:prior}).agent,'CTN');
 assert.equal(decideRoute({...base,ownClarityImpaired:true,ownClarityBasis:'uncertainty_only',ownClarityEvidence:reaction},{reportedMessages:current,functionalNeed:prior}).agent,'FBK');
 for(const [job,agent] of [['compare_paths','MNT'],['understand_impact','IMP'],['prepare_message','FBK']]){
  assert.equal(decideRoute({...base,job},{reportedMessages:messages,functionalNeed:prior}).agent,agent);
 }
 assert.equal(decideRoute({...base,scope:'outside'},{reportedMessages:messages,functionalNeed:prior}).mode,'outside_scope');
 assert.equal(decideRoute({...base,job:'unclear',confidence:'low',situationState:'DURING'},{reportedMessages:messages}).agent,null);
 assert.equal(decideRoute({...base,job:'conduct_live',conversationInProgress:false},{reportedMessages:messages}).agent,null);
});
test('Estado não aceita colagem arquivada, fonte do assistente ou referência errada; fontes múltiplas permanecem literais e separadas',()=>{
 for(const a of [t[2],t[3]])assert.equal(readSituation(a.analysis,a.messages).state,null);
 const a={...t[2].analysis,stateEvidence:'',stateReferences:[{message:1,quote:'Estou preparando para depois.'},{message:2,quote:'Quero falar das inconsistências nos relatórios'}]};
 const s=readSituation(a,t[2].messages);assert.equal(s.state,'BEFORE');assert.equal(s.references.length,2);
 assert.equal(s.evidence,'Estou preparando para depois.');
 assert.equal(readSituation({...a,stateReferences:[{message:1,quote:'O que você quer comunicar já está definido'}]},t[2].messages).state,null);
});
test('T4 não falha por sugerir; passado afirmativo ainda precisa de fonte; negação/futuro/infinitivo não são história executada',()=>{
 for(const g of t[3].generationAttempts)assert.deepEqual(validateGrounding(g.input,t[3].messages,[g.input.text]),[]);
 for(const text of ['Antes de sugerir um começo, quero entender.','Não sugeri uma fala pronta.','Nunca ofereci duas opções.','Vou sugerir uma opção.','Você poderá executar a conversa.','Não posso afirmar que você executou a conversa.']){
  assert.doesNotThrow(()=>validateGrounding({operationalClaims:[]},t[3].messages,[text]));
 }
 for(const text of ['Sugeri duas opções.','Ofereci uma frase.','Você executou a conversa.','Não sugeri, mas mostrei duas opções.','Não sugeri e mostrei duas opções.']){
  assert.throws(()=>validateGrounding({operationalClaims:[]},t[3].messages,[text]),/UNSUPPORTED_FACT/);
 }
 assert.doesNotThrow(()=>validateGrounding({operationalClaims:[{kind:'prior_assistant_content',role:'assistant',message:0,quote:'Uma opção concreta.',text:'Sugeri uma opção.'}]},[{role:'assistant',content:'Uma opção concreta.'}],['Sugeri uma opção.']));
 assert.throws(()=>validateGrounding({operationalClaims:[{kind:'prior_assistant_content',role:'user',message:0,quote:'Uma opção concreta.',text:'Sugeri uma opção.'}]},[{role:'user',content:'Uma opção concreta.'}],['Sugeri uma opção.']),/UNSUPPORTED_FACT/);
});
test('Precisão histórica não aprova cascata: objetos antigos produzem códigos de apresentação; apoio direto com questão focal passa',async()=>{
 const events=[],p=provider(t[3].generationAttempts.map(g=>g.input),events);
 await p.respond({agent:'FBK',system:profile.prompt,messages:t[3].messages,history:[],turn:{number:4,max:10}});
 assert.deepEqual(events.filter(e=>e.phase==='validation').map(e=>e.code),['ACCEPTED','ACCEPTED']);
 assert.deepEqual(events.filter(e=>e.phase==='presentation').map(e=>e.code),['RESPONSE_CONSTRAINT_FAILED','RESPONSE_CONSTRAINT_FAILED']);
 const r=await provider([supportive]).respond({agent:'FBK',system:profile.prompt,messages:t[3].messages,history:[],turn:{number:4,max:10}});
 assert.equal(r.progress.stage,'explore');assert.equal((r.text.match(/\?/g)||[]).length,1);assert.equal(r.progress.delivery,null);
 // An exact previously asked question is not repeated as a category menu.
 assert.notEqual(focalQuestion('',t[0].route.question,t[1].messages),t[0].route.question);
});
test('Classificador recebe contexto e fontes indexadas; nova saída máxima está no payload que o orçamento reserva',async()=>{
 const payloads=[],p=provider([t[1].analysis],[],payloads);
 await p.classify({messages:t[1].messages,history:[],previousAgent:null,functionalNeed:readFunctionalNeed(t[0].analysis,t[0].messages)});
 assert.equal(payloads[0].max_tokens,1200);assert.match(payloads[0].system,/decisão substantiva/);assert.match(payloads[0].system,/stateReferences/);
 assert.match(payloads[0].system,/"userMessage":1,"conversationMessage":2/);
 const b=createPilotBudget(structuredClone(original.budget));
 await b.call(payloads[0],async()=>({usage:{input_tokens:10,output_tokens:10}}));
 assert.equal(b.snapshot().calls,27);assert.equal(b.snapshot().estimatedUSD,0.412878);
 const schema=payloads[0].tools[0].input_schema;assert(schema.$defs.userReference);
 assert.equal(schema.properties.stateReferences.items.$ref,'#/$defs/userReference');
});
test('Serviço persiste contexto/objetos em memória isolada; triagem não reinicia limite de dez nem força compromisso no fechamento',async()=>{
 const state=prepareFifthRound(original,1000),scope={userId:FIFTH_IDENTITY.id,organizationId:FIFTH_IDENTITY.organizationId},store=createPilotStore(state,()=>{},FIFTH_IDENTITY),session=store.open(scope);
 let i=0,responses=0;
 const service=createConversationService({repository:store.repository,classify:async()=>structuredClone(t[Math.min(i++,3)].analysis),respond:async({messages,turn})=>{
  responses++;
  if(turn.number===10)return validateProgress({...supportive,stage:'close',completed:[],pending:['FBK.intent','FBK.facts','FBK.distortion','FBK.next'],closingSummary:'Você quer abordar fatos preservando sua própria elaboração; a causa permanece uma lacuna.',nextStep:'Retomar a abordagem que pretende construir, sem assumir compromisso ou execução.'},profile,messages,turn);
  return validateProgress({...supportive,text:'Os fatos e a preocupação com a relação merecem ser separados, sem presumir a causa das falhas. Como você pretende abordar a conversa?',completed:[],pending:['FBK.intent','FBK.facts','FBK.distortion','FBK.next']},profile,messages,turn);
 },agentPrompts:prompts});
 for(let n=0;n<10;n++){
  const content=n<4?t[n].messages.at(-1).content:'Ainda quero trabalhar minha abordagem.';
  const r=await service.turn(scope,{sessionId:session.id,requestId:'fictitious-context-'+n,content});
  assert.equal(r.exchangeCount,n+1);if(n===2)assert.equal(r.route.agent,'FBK');if(n===9)assert.equal(r.status,'closed');
 }
 assert.equal(responses,9);assert.equal(state.audit[2].functionalNeed.inherited,true);
 assert.deepEqual(Object.keys(state.session.context).sort(),['agentType','routingVersion']);
 await assert.rejects(service.turn(scope,{sessionId:session.id,requestId:'fictitious-extra-10',content:'Outra fala.'}),/SESSION_CLOSED/);
});
test('Rodada5 preserva integralmente rodada4/custo, recusa escopo anterior e reserva insuficiente antes de chamar SDK',async()=>{
 const before=JSON.stringify(original),state=prepareFifthRound(original,1000);
 assert.equal(JSON.stringify(original),before);assert.equal(state.version,require('../artifacts/api-server/src/lib/pilot-rounds.cjs').PILOT_STATE_VERSION);assert.equal(state.round,5);
 assert.deepEqual(state.archivedRounds.at(-1).original,original);
 assert.equal(state.archivedRounds.at(-1).original.session.exchangeCount,3);
 assert.equal(state.budget.charged,412818);assert.equal(state.budget.calls.length,26);
 assert.strictEqual(prepareFifthRound(state,9000000),state);assert.equal(state.expiresAt,7201000);
 const store=createPilotStore(state,()=>{},FIFTH_IDENTITY),s=store.open({userId:FIFTH_IDENTITY.id,organizationId:FIFTH_IDENTITY.organizationId});
 assert.equal(s.exchangeCount,0);assert.deepEqual(s.messages,[]);
 assert.throws(()=>store.open({userId:FOURTH_IDENTITY.id,organizationId:FOURTH_IDENTITY.organizationId}),/SCOPE_DENIED/);
 assert.deepEqual(state.audit,[]);
 assert.throws(()=>prepareFifthRound({...original,budget:{...original.budget,calls:[{status:'reserved'}]}},1000),/STATE_MISMATCH/);
 const b=createPilotBudget(state.budget);assert.equal(b.snapshot().remainingUSD,4.587182);assert.equal(b.snapshot().capUSD,5);
 const calls=state.budget.calls.length;state.budget.charged=4999999;let sent=false;
 await assert.rejects(b.call({model:'claude-sonnet-4-5',max_tokens:2200,messages:[]},async()=>{sent=true;}),/BUDGET_LIMIT/);
 assert.equal(sent,false);
 assert.equal(state.budget.charged,4999999);assert.equal(state.budget.calls.length,calls);
});
