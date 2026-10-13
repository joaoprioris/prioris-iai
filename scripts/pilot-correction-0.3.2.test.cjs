'use strict';
// Memory-only fixtures and injected SDK. Never sends to a provider or database.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {decideRoute,readRisk,ROUTING_VERSION}=require('../artifacts/api-server/src/lib/functional-policy.cjs');
const {prepareThirdRound,SECOND_IDENTITY,THIRD_IDENTITY}=require('../artifacts/api-server/src/lib/pilot-rounds.cjs');
const {createPilotStore}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const contract=require('../artifacts/api-server/src/lib/agent-contract.json');
const profile=contract.agents.find(a=>a.id==='OTO');
const prompts=Object.fromEntries(contract.agents.map(a=>[a.id,a.prompt]));
const old=JSON.parse(fs.readFileSync('generated-artifacts/pilot-0.3.1-round-2-preserved/state.original.json'));
const observed=old.audit;
const userText='Não sei qual data é viável. O cliente espera e não posso validar com o time em segundos.';
const messages=[{role:'user',content:userText}];
const observation=extra=>({scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true,immediateExternalRisk:false,riskBasis:'uncertainty_only',riskEvidence:'',riskImpactEvidence:'',ownClarityImpaired:false,ownClarityEvidence:'',ownClarityBasis:'insufficient',...extra});
const response=extra=>({text:'Há uma divergência e falta validação; comunique essa lacuna sem escolher data.',stage:'direct',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',operationalClaims:[],...extra});
const close=response({stage:'close',closingSummary:'Há duas datas relatadas, mas a viabilidade continua sem validação.',nextStep:'Comunique que a data ainda precisa ser validada, sem assumir uma delas.',delivery:{kind:'micro_move',text:'Há informações diferentes; preciso validar a viabilidade com o time antes de confirmar uma data.'}});
const bundle=require(path.resolve('artifacts/api-server/node_modules/esbuild')).buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
const name=path.resolve('artifacts/api-server/isolated-correction-adapter.cjs');
const mod=new Module(name,module);mod.filename=name;mod.paths=Module._nodeModulePaths(path.dirname(name));mod._compile(bundle.outputFiles[0].text,name);
const {createModelProviders}=mod.exports;
function adapter(values,events=[],sent=[]){
 return createModelProviders({onGenerationObservation:e=>events.push(structuredClone(e)),client:{messages:{create:async payload=>{
  sent.push(payload);const input=values.shift();if(input instanceof Error)throw input;
  return {stop_reason:'tool_use',content:[{type:'tool_use',name:payload.tool_choice.name,input}],usage:{input_tokens:10,output_tokens:10}};
 }}}});
}
test('Registro observado T2 não basta para risco nem incapacidade; leitura funcional não é forçada',()=>{
 const a=observed[1].analysis;
 const current=[{role:'user',content:a.riskEvidence},{role:'user',content:userText}];
 assert.equal(readRisk(a,current).verified,false);
 assert.equal(decideRoute(a,{reportedMessages:current},'OTO').agent,'OTO');
 for(const [job,expected] of [['compare_paths','MNT'],['understand_impact','IMP'],['prepare_message','FBK']]){
  assert.equal(decideRoute(observation({job,decisionSufficientlyClear:true}),{reportedMessages:messages}).agent,expected);
 }
 assert.equal(decideRoute(observation({conversationInProgress:false}),{reportedMessages:messages}).mode,'clarify');
});
test('Riscos físicos e organizacionais concretos atuais mantêm prioridade; correção invalida citação antiga',()=>{
 for(const [kind,text] of [['physical','Ele continua ameaçando atacar a equipe com uma faca.'],['organizational','Dados sigilosos estão sendo publicados sem autorização neste momento.']]){
  const a=observation({immediateExternalRisk:true,riskKind:kind,riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:text,riskImpactEvidence:text});
  const m=[{role:'user',content:text}];assert.equal(readRisk(a,m).verified,true);assert.equal(decideRoute(a,{reportedMessages:m}).agent,'CRS');
  m.push({role:'user',content:'A situação cessou; agora preciso pensar alternativas.'});
  assert.equal(readRisk(a,m).verified,false);
 }
});
test('Contenção exige reação própria pertinente atual e base qualificada, não apenas booleano',()=>{
 const text='Estou em pânico e minha reação está me impedindo de julgar.';
 const a=observation({ownClarityImpaired:true,ownClarityBasis:'reaction_or_overload_impeding_judgment',ownClarityEvidence:text});
 assert.equal(decideRoute(a,{reportedMessages:[{role:'user',content:text}]}).agent,'CTN');
 assert.equal(decideRoute(a,{reportedMessages:messages}).agent,'OTO');
 assert.equal(decideRoute({...a,ownClarityBasis:'uncertainty_only',ownClarityEvidence:userText},{reportedMessages:messages}).agent,'OTO');
});
test('Respostas observadas T2/T3 falham em compromissos e histórico sem base',()=>{
 assert.throws(()=>validateProgress(response({text:observed[1].result.text}),profile,messages,{number:2}),/UNSUPPORTED_FACT/);
 assert.throws(()=>validateProgress({...close,closingSummary:observed[2].result.text},profile,messages,{number:3}),/UNSUPPORTED_FACT/);
 for(const text of ['Vou confirmar com o time e retorno ainda hoje.','Assuma sexta por segurança.','Vou validar agora e já confirmo.']){
  assert.throws(()=>validateProgress(response({text}),profile,messages,{number:1}),/UNSUPPORTED_FACT/);
 }
 assert.throws(()=>validateProgress(response({text:'Qual dos dois prazos funciona melhor pra vocês?'}),profile,messages,{number:1}),/UNSUPPORTED_FACT/);
 const question='Qual dos dois prazos funciona melhor pra vocês?',quote='As duas datas estão confirmadas e são viáveis.';
 validateProgress(response({text:question,operationalClaims:[{kind:'viability',text:question,role:'user',message:0,quote}]}),profile,[{role:'user',content:quote}],{number:1});
});
test('Comunicar lacuna e próximo movimento opcional sem data é aceito; fechamento mantém critérios pendentes',()=>{
 const r=validateProgress(close,profile,messages,{number:3});
 assert.equal(r.progress.stage,'close');assert.equal(r.progress.completed.length,0);assert.equal(r.progress.pending.length,profile.diagnostic_criteria.length);
 assert.equal(r.progress.delivery.text,close.delivery.text);
 assert.doesNotMatch(r.text,/hoje|sexta|quarta|imediatamente/);
 validateProgress(response({text:'Se for possível depois, valide com o time; por enquanto, comunique que falta confirmar a viabilidade.'}),profile,messages,{number:1});
});
test('Duplicação da entrega observada em T1 é rejeitada; entrega única compõe uma vez',()=>{
 const phrase='Preciso validar a viabilidade antes de confirmar uma data.';
 assert.throws(()=>validateProgress(response({text:phrase,delivery:{kind:'micro_move',text:phrase}}),profile,messages,{number:1}),/DUPLICATE_DELIVERY/);
 assert.throws(()=>validateProgress({...close,nextStep:phrase,delivery:{kind:'micro_move',text:phrase}},profile,messages,{number:3}),/DUPLICATE_DELIVERY/);
 const r=validateProgress(response({delivery:{kind:'micro_move',text:phrase}}),profile,messages,{number:1});
 assert.equal(r.text.split(phrase).length-1,1);
});
test('Conteúdo interno não serve como resposta passada; compromisso só com origem declarada',()=>{
 const hidden='Você recebeu duas opções para retornar ao cliente.';
 assert.throws(()=>validateProgress(response({text:'Ofereci duas opções.',operationalClaims:[{kind:'prior_assistant_content',text:'Ofereci duas opções.',role:'assistant',message:0,quote:hidden}]}),profile,messages,{number:3}),/UNSUPPORTED_FACT/);
 const text='Vou retornar às 16h.';
 const commitment='Posso retornar às 16h.';
 const c={kind:'time_commitment',text,role:'user',message:0,quote:commitment};
 assert.throws(()=>validateProgress(response({text,operationalClaims:[c]}),profile,messages,{number:1}),/UNSUPPORTED_FACT/);
 validateProgress(response({text,operationalClaims:[c]}),profile,[{role:'user',content:commitment}],{number:1});
});
test('Adaptador real recupera suposição/duplicação e não entrega primeira tentativa; registra objetos completos',async()=>{
 const events=[],sent=[];const bad=response({text:'Vou retornar ainda hoje.'});
 const p=adapter([bad,close],events,sent);
 const result=await p.respond({agent:'OTO',system:profile.prompt,messages,history:[],turn:{number:3,max:10}});
 assert.equal(sent.length,2);assert.equal(events.length,2);
 assert.deepEqual(events[0].input,bad);assert.deepEqual(events[1].input,close);assert.equal(result.progress.stage,'close');assert.doesNotMatch(result.text,/hoje/);
 assert.match(sent[0].system,/EXIBIDAS/);assert.match(sent[0].system,/não escolha a mais tardia/);assert.match(sent[1].system,/Não repita compromisso sem base/);
 const q=adapter([response({text:close.delivery.text,delivery:close.delivery}),close]);
 assert.equal((await q.respond({agent:'OTO',system:profile.prompt,messages,history:[],turn:{number:3}})).progress.stage,'close');
});
test('Esquema/prompts reais exigem evidência atual de dano e emoção, sem nova classificação do caso',async()=>{
 const sent=[];await adapter([observation()],[],sent).classify({messages,history:[],previousAgent:'OTO'});
 const schema=sent[0].tools[0].input_schema;
 for(const field of ['riskImpactEvidence','ownClarityEvidence','ownClarityBasis'])assert(schema.required.includes(field));
 assert.match(sent[0].system,/não incapacidade emocional/);
 assert.match(sent[0].system,/não apenas o cenário/);
});
test('Rodada 3 arquiva exatamente rodada 2, mantém gastos e reinício não renova janela',()=>{
 const s=prepareThirdRound(old,1000);
 assert.equal(s.version,'0.3.2');assert.equal(s.round,3);assert.equal(s.budget.charged,97084);assert.equal(s.budget.calls.length,8);
 assert.equal(s.archivedRounds.length,2);assert.deepEqual(s.archivedRounds[1].original,old);assert.equal(s.archivedRounds[0].classificationEvidence,'not-recorded');
 assert.equal(s.archivedRounds[1].generationEvidence,'not-recorded');assert.equal(s.session,undefined);assert.deepEqual(s.audit,[]);
 assert.equal(prepareThirdRound(s,999999999),s);assert.equal(s.expiresAt,7201000);
 const store=createPilotStore(s,()=>{},THIRD_IDENTITY),scope={userId:THIRD_IDENTITY.id,organizationId:THIRD_IDENTITY.organizationId};
 const session=store.open(scope);assert.equal(session.exchangeCount,0);assert.deepEqual(session.messages,[]);
 assert.throws(()=>store.open({userId:SECOND_IDENTITY.id,organizationId:SECOND_IDENTITY.organizationId}),/SCOPE_DENIED/);
});
test('Piloto preserva geração/estágio/critério/entrega e mensagens depois do fechamento, sem mudar contexto privado',async()=>{
 const s=prepareThirdRound(old,1000),scope={userId:THIRD_IDENTITY.id,organizationId:THIRD_IDENTITY.organizationId};
 const store=createPilotStore(s,()=>{},THIRD_IDENTITY),session=store.open(scope);
 const service=createConversationService({repository:store.repository,classify:async()=>observation(),respond:async()=>validateProgress(close,profile,messages,{number:1}),agentPrompts:prompts});
 const r=await service.turn(scope,{sessionId:session.id,requestId:'fictitious-close-1',content:userText});
 assert.equal(r.status,'closed');assert.equal(s.session.exchangeCount,1);assert.deepEqual(Object.keys(s.session.context).sort(),['agentType','routingVersion']);
 assert.deepEqual(s.audit[0].messages,messages);assert.equal(s.audit[0].generation.progress.stage,'close');
 assert.deepEqual(s.audit[0].generation.progress.pending,close.pending);assert.deepEqual(s.audit[0].generation.progress.delivery,close.delivery);
 await store.repository.recordGenerationObservation(scope,{turn:1,agent:'OTO',attempt:1,input:close});
 assert.deepEqual(s.audit[0].generationAttempts[0].input,close);
 await assert.rejects(store.repository.recordGenerationObservation({userId:'other',organizationId:scope.organizationId},{turn:1}),/SCOPE_DENIED/);
 await assert.rejects(service.turn(scope,{sessionId:session.id,requestId:'fictitious-close-2',content:'Aceitei.'}),/SESSION_CLOSED/);
});
test('Teto acumulado inclui novas chamadas e recuperação; nega antes de SDK e mantém dez trocas globais',async()=>{
 const s=prepareThirdRound(old,1000),b=createPilotBudget(s.budget);let calls=0;
 const p={model:'claude-sonnet-4-5',max_tokens:2200,system:'Fictício',messages:[]};
 for(let i=0;i<2;i++)await b.call(p,async()=>{calls++;return {usage:{input_tokens:10,output_tokens:10}};});
 assert.equal(s.budget.charged,97444);assert.equal(s.budget.calls.at(-1).round,3);assert.equal(s.budget.calls.at(-1).maxOutput,2200);
 s.budget.charged=999999;await assert.rejects(b.call(p,async()=>{calls++;}),/BUDGET_LIMIT/);assert.equal(calls,2);
 const scope={userId:THIRD_IDENTITY.id,organizationId:THIRD_IDENTITY.organizationId},store=createPilotStore({},()=>{},THIRD_IDENTITY),session=store.open(scope);
 const service=createConversationService({repository:store.repository,classify:async()=>observation(),respond:async({turn})=>validateProgress(turn.number===10?close:response(),profile,messages,turn),agentPrompts:prompts});
 // Terminal fixture leaves no invented commitment and does not require every criterion.
 for(let n=1;n<=10;n++){
  const current=await store.repository.getSession(scope,session.id);
  assert.equal(current.exchangeCount,n-1);
  const r=await service.turn(scope,{sessionId:session.id,requestId:'fictitious-limit-'+n,content:userText});
  assert.equal(r.exchangeCount,n);
 }
 await assert.rejects(service.turn(scope,{sessionId:session.id,requestId:'fictitious-limit-11',content:userText}),/SESSION_CLOSED/);
 assert.equal(ROUTING_VERSION,'0.3.2');
});
