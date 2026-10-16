'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {decideRoute,readRisk,ROUTING_VERSION}=require('../artifacts/api-server/src/lib/functional-policy.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
const {prepareSecondRound,SECOND_IDENTITY}=require('../artifacts/api-server/src/lib/pilot-rounds.cjs');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const contract=require('../artifacts/api-server/src/lib/agent-contract.json');
const prompts=Object.fromEntries(contract.agents.map(a=>[a.id,a.prompt]));
const t1='Tô na reunião com o cliente. Meu time acabou de passar um prazo diferente do que eu tinha combinado. Corrijo agora ou seguro e alinho depois? Preciso responder.';
const t2='Não tem ameaça física. É só um prazo: eu falei quarta, a analista falou sexta e o cliente perguntou qual vale. Não sei de onde veio sexta. O que eu digo agora?';
const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId};
const observations=(extra={})=>({scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true,immediateExternalRisk:false,riskBasis:'uncertainty_only',riskKind:'organizational',riskEvidence:'',...extra});
const route=(a,text)=>decideRoute(a,{reportedMessages:[{role:'user',content:text}]});
function fixture(analysis,respond=async()=> 'Ajuda fictícia local.'){
 const state={},store=createPilotStore(state),session=store.open(scope);
 const service=createConversationService({repository:store.repository,classify:async()=>typeof analysis==='function'?analysis():analysis,respond,agentPrompts:prompts});
 let n=0;return {state,store,session,send:content=>service.turn(scope,{sessionId:session.id,requestId:'local-risk-'+(++n),content})};
}
test('Divergência/urgência não validam risco por flag ou citação sem base concreta; condução deriva da função',()=>{
 for(const text of [t1,t2,'O fornecedor indicou duas quantidades e me perguntam qual confirmar agora.']){
  const a=observations({immediateExternalRisk:true,riskEvidence:text});
  assert.equal(readRisk(a,[{role:'user',content:text}]).verified,false);assert.equal(route(a,text).agent,'OTO');
 }
});
test('Sem qualificação ou com citação inventada/do assistente, não há prioridade de emergência',()=>{
 const a=observations({immediateExternalRisk:true,riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:'dano imaginado'});
 assert.equal(route(a,t1).agent,'OTO');
 assert.equal(decideRoute(a,{reportedMessages:[{role:'assistant',content:'dano imaginado'}]}).agent,'OTO');
 const missing={...a};delete missing.riskBasis;assert.equal(route(missing,'dano imaginado').agent,'OTO');
});
test('Risco físico explicitamente relatado mantém prioridade e proteção sem geração',async()=>{
 const text='Um funcionário está ameaçando me agredir agora na sala.';
 let generations=0;
 const f=fixture(observations({riskKind:'physical',immediateExternalRisk:true,riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:text,riskImpactEvidence:text}),async()=>{generations++;return 'não usado';});
 const r=await f.send(text);assert.equal(r.route.agent,'CRS');assert.match(r.text,/segurança|integridade física/);assert.match(r.text,/não entre em confronto/);assert.equal(generations,0);
});
test('Crise organizacional concreta usa função documentada/geração, não resposta fixa de emergência física',async()=>{
 const text='A publicação com dados confidenciais continua acessível a terceiros agora.';
 let received;
 const f=fixture(observations({immediateExternalRisk:true,riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:text,riskImpactEvidence:text}),
  async p=>{received=p;return 'Considere conter a exposição com quem tem atribuição para isso; falta saber qual acesso está disponível.';});
 const r=await f.send(text);assert.equal(r.route.agent,'CRS');assert(received);assert.match(received.system,/Organizar próximo passo seguro/);
 assert.match(received.system,/Não acrescente instruções de afastamento físico/);
 assert.doesNotMatch(r.text,/ameaça física|emergência local/);
});
test('Correção do líder muda risco, estado e agente; contagem global não reinicia',async()=>{
 const danger='Há ameaça concreta de agressão acontecendo agora.';
 const sequence=[
  observations({immediateExternalRisk:true,riskBasis:'concrete_immediate_threat_or_harm',riskKind:'physical',riskEvidence:danger,riskImpactEvidence:danger,situationState:'DURING',stateEvidence:danger}),
  observations({situationState:'DURING',stateEvidence:'O que eu digo agora?'}),
 ];
 let received;
 const f=fixture(()=>sequence.shift(),async p=>{received=p;return 'Falta confirmar a origem do segundo prazo. Você pode reconhecer essa lacuna antes de confirmar uma data.';});
 const a=await f.send(danger),b=await f.send(t2);
 assert.equal(a.route.agent,'CRS');assert.equal(b.route.agent,'OTO');assert.equal(b.exchangeCount,2);assert.equal(b.route.transition,true);
 assert.equal(received.turn.riskReading.verified,false);assert.equal(received.turn.situationReading.evidence,'O que eu digo agora?');
 assert.doesNotMatch(b.text,/emergência|segurança|quarta|sexta/);
 assert.equal(f.state.audit.length,2);assert.equal(f.state.audit[1].analysis.immediateExternalRisk,false);
 assert.equal(f.state.audit[1].result.route.agent,'OTO');
});
test('T1/T2 locais geram ajuda com lacuna e próxima fala sem data/execução/culpa inventadas',async()=>{
 const sequence=[observations({situationState:'DURING',stateEvidence:'Tô na reunião com o cliente.'}),observations({situationState:'DURING',stateEvidence:'O que eu digo agora?'})];
 const f=fixture(()=>sequence.shift(),async p=>{
  assert.equal(p.history.length,0);assert.equal(p.agent,'OTO');
  assert.match(p.system,/Incerteza não autoriza inventar data, execução, culpa, política ou obrigação/);
  return 'Há duas informações e falta a confirmação da segunda. Uma fala possível: “Tenho duas informações de prazo; preciso confirmar a base antes de assumir uma data.”';
 });
 const a=await f.send(t1),b=await f.send(t2);assert.equal(a.route.agent,'OTO');assert.equal(b.route.agent,'OTO');assert.equal(b.exchangeCount,2);
 assert.equal(f.state.audit[0].version,ROUTING_VERSION);assert.equal(f.state.audit[1].outcome,'completed');
 // The response above is a fixture, not an observed AI reply.
});
test('Fronteiras funcionais não são forçadas pelo caso, reunião ou Durante',()=>{
 assert.equal(route(observations({job:'compare_paths'}),t1).agent,'MNT');
 assert.equal(route(observations({job:'prepare_message',decisionSufficientlyClear:true,conversationInProgress:false}),t1).agent,'FBK');
 assert.equal(route(observations({job:'understand_impact'}),t1).agent,'IMP');
 assert.equal(route(observations({job:'unclear',situationState:'DURING'}),t1).agent,null);
 assert.equal(route(observations({personalEmergency:true}),t1).mode,'human_support');
});
test('Falha após classificação conserva observação estruturada sem declarar turno concluído',async()=>{
 const f=fixture(observations(),async()=>{throw Error('LOCAL_PROVIDER_OUTAGE');});
 await assert.rejects(f.send(t1),e=>e.code==='MODEL_UNAVAILABLE');
 assert.equal(f.state.session.exchangeCount,0);assert.equal(f.state.audit[0].outcome,'failed');
 assert.equal(f.state.audit[0].failure.code,'MODEL_UNAVAILABLE');
 assert.equal(f.state.audit[0].version,ROUTING_VERSION);
 assert.equal(f.state.session.context.messages,undefined);
 assert.equal(f.state.audit[0].analysis.job,'conduct_live');
});
test('Rodada 2 preserva rodada 1 byte-logicamente, observações antigas ausentes e gasto acumulado',()=>{
 const old={version:'0.3.0',provider:'replit',session:{userId:IDENTITY.id,organizationId:IDENTITY.organizationId,exchangeCount:2,context:{messages:[{role:'user',content:t1},{role:'assistant',content:'Resposta fixa original.'}]}},requests:{first:'original'},budget:{charged:8771,calls:[{model:'claude-haiku-4-5',estimatedMicroUSD:4298},{model:'claude-haiku-4-5',estimatedMicroUSD:4473}],blocked:false}};
 const before=JSON.stringify(old),s=prepareSecondRound(old,10000);
 assert.equal(JSON.stringify(old),before);assert.equal(JSON.stringify(s.archivedRounds[0].original),before);
 assert.equal(s.archivedRounds[0].classificationEvidence,'not-recorded');assert.equal(s.session,undefined);assert.deepEqual(s.audit,[]);
 assert.equal(s.budget.charged,8771);assert.equal(s.budget.calls.length,2);
 const store=createPilotStore(s,()=>{},SECOND_IDENTITY),newScope={userId:SECOND_IDENTITY.id,organizationId:SECOND_IDENTITY.organizationId};
 const session=store.open(newScope);assert.deepEqual(session.messages,[]);assert.equal(session.exchangeCount,0);assert.notEqual(session.userId,IDENTITY.id);
 assert.throws(()=>store.open(scope),/SCOPE_DENIED/);
 const restarted=prepareSecondRound(s,99999);assert.equal(restarted,s);assert.equal(restarted.expiresAt,10000+7200000);assert.equal(restarted.budget.charged,8771);
});
test('Teto conjunto não se renova na rodada 2; uso novo soma ao anterior',async()=>{
 const state={charged:8771,calls:[],currentRound:2},b=createPilotBudget(state);
 await b.call({model:'claude-haiku-4-5',max_tokens:600,system:'fictício',messages:[]},async()=>({usage:{input_tokens:100,output_tokens:20}}));
 assert.equal(state.charged,8971);assert.equal(state.calls[0].round,2);assert.equal(b.snapshot().capUSD,5);
 const calls=state.calls.length;state.charged=4999999;let sent=false;
 await assert.rejects(b.call({model:'claude-sonnet-4-5',max_tokens:2200,messages:[]},async()=>{sent=true;}),/BUDGET_LIMIT/);assert.equal(sent,false);
 assert.equal(state.charged,4999999);assert.equal(state.calls.length,calls);
});
test('Metodologia original de Crises e definições dos demais agentes preservadas',()=>{
 const fs=require('node:fs');
 const original=require('../prioris-routing-consolidation-20261012/agent_contract.json');
 const {resolveContract,REVISION}=require('../artifacts/api-server/src/lib/ex04-reference.cjs'); const {AGENTS}=require('../artifacts/api-server/src/lib/functional-policy.cjs'); const effective=resolveContract();
 assert.equal(contract.agents.length,8);assert.equal(contract.methodology_revision,REVISION);assert.equal(effective.version,REVISION);
 for(const current of contract.agents){
  const source=original.agents.find(a=>a.id===current.id);assert(source);
  for(const key of ['source_definition','determinations','allowed_transversal_lenses'])assert.deepEqual(current[key],source[key]);
 }
 // The approved EX04 effective resolution is allowed to differ from the old
 // emergency-only interpretation, not from the preserved source definitions.
 const crises=effective.agents.find(a=>a.id==='CRS');
 assert.match(crises.prompt,/antes, durante (?:e|ou) depois/i);
 assert.match(crises.prompt,/dano em curso|ameaça concreta/i);
 assert.equal(AGENTS.includes('EVL'),false);assert(effective.agents.some(a=>a.id==='EVL'));assert.deepEqual(effective.background_capabilities,[]);assert.throws(()=>decideRoute(observations({job:'EVL'})),/Invalid job/);
 assert.equal(decideRoute(observations()).background.length,0);
 assert.equal(fs.existsSync('generated-artifacts/pilot-0.3.0-round-1-preserved/state.original.json'),true);
});
