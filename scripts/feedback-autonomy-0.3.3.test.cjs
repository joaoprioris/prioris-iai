'use strict';
// Deterministic source repair, output controls and injected provider only.
// Archived records are read, never rewritten; database access throws.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {resolveUserEvidence,deduplicateDelivery}=require('../artifacts/api-server/src/lib/evidence-source.cjs');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {createPilotStore}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
const {prepareFourthRound,THIRD_IDENTITY,FOURTH_IDENTITY}=require('../artifacts/api-server/src/lib/pilot-rounds.cjs');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {ROUTING_VERSION}=require('../artifacts/api-server/src/lib/functional-policy.cjs');
const contract=require('../artifacts/api-server/src/lib/agent-contract.json'),profile=contract.agents.find(a=>a.id==='FBK');
const prompts=Object.fromEntries(contract.agents.map(a=>[a.id,a.prompt]));
const original=JSON.parse(fs.readFileSync('generated-artifacts/pilot-0.3.2-round-3-preserved/state.original.json'));
const failed3=original.audit.find(a=>a.turn===3&&a.outcome==='classified'),failed4=original.audit.find(a=>a.turn===4);
const leader='Quero abordar o retrabalho, perguntar como ele vê isso e entender antes de combinar mudanças.';
const messages=[{role:'user',content:leader}];
const authorship={supportMode:'explore',approachEvidence:[],examplePurpose:''};
const envelope=(extra={})=>({text:'Retrabalho é o efeito confirmado; a causa continua aberta. A tensão é nomear o fato sem atribuir intenção. Como você pretende abordar isso?',stage:'explore',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',operationalClaims:[],authorship,...extra});
const classify={scope:'leadership',job:'prepare_message',confidence:'high',conversationInProgress:false,decisionSufficientlyClear:true,ownClarityImpaired:false,immediateExternalRisk:false,riskBasis:'insufficient',riskEvidence:'',riskImpactEvidence:'',situationState:'BEFORE',stateEvidence:'Quero abordar o retrabalho'};
const bundle=require(path.resolve('artifacts/api-server/node_modules/esbuild')).buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
const filename=path.resolve('artifacts/api-server/isolated-autonomy-adapter.cjs'),mod=new Module(filename,module);
mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(bundle.outputFiles[0].text,filename);
const {createModelProviders}=mod.exports;
function providers(values,{received=[],validations=[],payloads=[],budget=null}={}){
 return createModelProviders({onGenerationObservation:e=>received.push(structuredClone(e)),onValidationObservation:e=>validations.push(structuredClone(e)),client:{messages:{create:async p=>{
  payloads.push(p);const send=async()=>{
   const input=values.shift();if(input instanceof Error)throw input;
   return {stop_reason:'tool_use',content:[{type:'tool_use',name:p.tool_choice.name,input}],usage:{input_tokens:10,output_tokens:10}};
  };
  return budget?budget.call(p,send):send();
 }}}});
}
test('Citações de T3/T4 corrigem referências inequívocas e preservam o texto fonte exato e o bruto',()=>{
 for(const a of [failed3,failed4])for(const g of a.generationAttempts){
  const before=JSON.stringify(g.input);
  for(const c of g.input.completed)for(const e of c.evidence){
   const r=resolveUserEvidence(e,a.messages),users=a.messages.filter(m=>m.role==='user');
   assert(users[r.evidence.message].content.includes(r.evidence.quote));
   if(e.quote.includes("'Como você está vendo isso?'")){
    assert.match(r.evidence.quote,/“Como você está vendo isso\?”/);
    assert.equal(r.evidence.message,3);assert.equal(r.normalization.raw.quote,e.quote);
   }
  }
  assert.equal(JSON.stringify(g.input),before);
 }
 const r=resolveUserEvidence(failed3.generationAttempts[1].input.completed[0].evidence[1],failed3.messages);
 assert.equal(r.evidence.message,1);assert.equal(r.normalization.reason,'reference_only');
});
test('Ambiguidade, fala do assistente, paráfrase e mudança de pontuação não são recuperação permitida',()=>{
 const ref={message:8,quote:'Confirmo retrabalho'};
 for(const m of [
  [{role:'user',content:'Confirmo retrabalho'},{role:'user',content:'Confirmo retrabalho'}],
  [{role:'assistant',content:'Confirmo retrabalho'}],
  [{role:'user',content:'Confirmo trabalho repetido'}],
  [{role:'user',content:'Confirmo, retrabalho'}],
 ]){
  assert.throws(()=>resolveUserEvidence(ref,m),/INVALID_PROGRESS_EVIDENCE/);
 }
 assert.throws(()=>resolveUserEvidence({message:0,quote:'Ele disse \"sim\"'},[{role:'user',content:'Ele disse “sim” e Ele disse ‘sim’'}]),/INVALID_PROGRESS_EVIDENCE/);
});
test('Aspas e espaços só normalizam apresentação, mantendo recorte exato original',()=>{
 const source='Eu perguntaria “Como  você\nestá vendo isso?” antes de concluir.';
 const r=resolveUserEvidence({message:4,quote:"Eu perguntaria 'Como você está vendo isso?'"},[{role:'user',content:source}]);
 assert.equal(r.evidence.quote,'Eu perguntaria “Como  você\nestá vendo isso?”');
 assert.equal(r.evidence.message,0);assert.equal(r.normalization.sourceRole,'user');
});
test('Duplicação literal arquivada compõe uma exibição sem nova chamada nem troca de palavras',()=>{
 const raw=failed3.generationAttempts[0].input;
 const d=deduplicateDelivery([raw.text],raw.delivery.text);
 assert.equal(d.append,false);assert.equal(d.parts[0],raw.text);assert.equal(d.normalizations[0].kind,'delivery_already_visible');
 const repeated=deduplicateDelivery(['Leitura. '+raw.delivery.text+'\n'+raw.delivery.text],raw.delivery.text);
 assert.equal(repeated.parts[0].split(raw.delivery.text).length-1,1);assert.equal(repeated.append,false);
});
test('Feedback explora elaboração com leitura concreta, sem entrega automática nem roteiro obrigatório',()=>{
 const r=validateProgress(envelope(),profile,messages,{number:1});
 assert.equal(r.progress.delivery,null);assert.equal(r.progress.authorship.supportMode,'explore');assert.match(r.text,/causa continua aberta/);
 assert.equal((r.text.match(/\?/g)??[]).length,1);
 const review={supportMode:'review',approachEvidence:[{message:0,quote:leader}],examplePurpose:''};
 validateProgress(envelope({text:'Sua abordagem separa fato de causa e reserva espaço para ouvir. O efeito confirmado é o retrabalho; a solução continua aberta.',authorship:review}),profile,messages,{number:2});
});
test('Receita automática ou exemplo sem elaboração fonte são recusados; exemplo opcional apoia elaboração real',()=>{
 assert.throws(()=>validateProgress(envelope({text:'Diga essa frase e depois cobre revisão.'}),profile,messages,{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
 assert.throws(()=>validateProgress(envelope({delivery:{kind:'message',text:'Você precisa revisar antes de enviar.'}}),profile,messages,{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
 assert.throws(()=>validateProgress(envelope({authorship:{supportMode:'optional_example',approachEvidence:[{message:0,quote:'Frase que só existe no assistente'}],examplePurpose:'Revisar abertura'},delivery:{kind:'message',text:'Um exemplo.'}}),profile,messages,{number:1}),/INVALID_PROGRESS_EVIDENCE/);
 const phrase='Quero entender como você está vendo esse retrabalho.';
 const a={supportMode:'optional_example',approachEvidence:[{message:0,quote:leader}],examplePurpose:'Testar uma pequena variação da pergunta elaborada pelo líder.'};
 const r=validateProgress(envelope({text:'Sua pergunta mantém a causa aberta. Um exemplo opcional de variação: '+phrase,delivery:{kind:'message',text:phrase},authorship:a}),profile,messages,{number:2});
 assert.equal(r.text.split(phrase).length-1,1);assert.equal(r.progress.displayNormalizations[0].kind,'delivery_already_visible');
});
test('Receio não é moralizado; impactos negados não viram fatos por citar palavras presentes',()=>{
 for(const text of ['Você escolhe proteger seu conforto.','Adiar compromete a confiança.','A clareza protege a relação.']){
  assert.throws(()=>validateProgress(envelope({text}),profile,messages,{number:1}),/UNSUPPORTED_FACT/);
 }
 validateProgress(envelope({text:'Clareza não garante proteção da relação. Não podemos afirmar que isso afetou o planejamento; o efeito confirmado é o retrabalho.'}),profile,messages,{number:1});
 const denied=failed3.messages.filter(m=>m.role==='user')[2].content;
 const text='Isso afetou o planejamento.';
 assert.throws(()=>validateProgress(envelope({text,operationalClaims:[{kind:'impact',role:'user',message:0,quote:'afetou o planejamento',text}]}),profile,[{role:'user',content:denied}],{number:1}),/UNSUPPORTED_FACT/);
 const source='Isso afetou o planejamento.';
 validateProgress(envelope({text,operationalClaims:[{kind:'impact',role:'user',message:0,quote:source,text}]}),profile,[{role:'user',content:source}],{number:1});
});
test('Fechamento admite lacunas e movimento do líder sem afirmar execução, prazo ou compromisso',()=>{
 const close=envelope({stage:'close',closingSummary:'Você quer abordar o retrabalho e ouvir a leitura do colega; a causa ainda não foi confirmada.',nextStep:'Seu próximo movimento pode partir dessa elaboração, mantendo a causa aberta para ouvir antes de escolher ajustes.'});
 const r=validateProgress(close,profile,messages,{number:3});assert.equal(r.progress.pending.length,4);assert.equal(r.progress.stage,'close');assert.doesNotMatch(r.text,/amanhã|hoje|executou|assumiu/);
 assert.throws(()=>validateProgress({...close,closingSummary:'Você executou a conversa e confirmou a solução.'},profile,messages,{number:3}),/UNSUPPORTED_FACT/);
});
test('Feedback completo aceita abertura pedida, incorpora correção causal e respeita encerramento',()=>{
 const initial='Preciso dar feedback formal sobre um par. Em duas entregas, os dados chegaram depois do prazo e refiz a consolidação. Em uma delas, mudei o formato perto do prazo. Quero reconhecer minha parte e ouvir a leitura dele.';
 const request='Pode me dar uma abertura?';
 const correction='Correção: eu não disse que minha mudança causou o atraso; ela só aconteceu perto do prazo.';
 const opening='Quero conversar sobre duas entregas em que os dados chegaram depois do prazo. Em uma delas, também mudei o formato perto do prazo. Quero reconhecer minha parte e ouvir como você lê o que aconteceu.';
 const turns=[{role:'user',content:initial},{role:'assistant',content:'Vamos trabalhar a abertura.'},{role:'user',content:request}];
 const base={stage:'explore',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',operationalClaims:[]};
 const opened=validateProgress({...base,text:'Uma opção curta e adaptável para você ajustar ao seu tom:',delivery:{kind:'message',text:opening},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:1,quote:request}],basisEvidence:[{message:0,quote:'Em duas entregas, os dados chegaram depois do prazo e refiz a consolidação.'},{message:0,quote:'Em uma delas, mudei o formato perto do prazo.'}],examplePurpose:'Oferecer uma abertura curta para adaptação pelo líder.'}},profile,turns,{number:2});
 assert.equal(opened.text.split(opening).length-1,1);assert.equal(opened.progress.authorship.supportMode,'optional_example');
 turns.push({role:'assistant',content:opened.text},{role:'user',content:correction});
 const contradicted={...base,text:'Sua mudança de formato causou parte do atraso. Vale reconhecer isso antes de ouvir a leitura dele.',delivery:null,authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''}};
 assert.throws(()=>validateProgress(contradicted,profile,turns,{number:3}),/UNSUPPORTED_FACT/);
 const corrected=validateProgress({...contradicted,text:'Sua correção separa coincidência temporal de atribuição: a mudança de formato ocorreu perto do prazo; causa e contribuição continuam abertas.'},profile,turns,{number:3});
 assert.match(corrected.text,/causa e contribuição continuam abertas/);
 turns.push({role:'assistant',content:corrected.text},{role:'user',content:'Pode encerrar por aqui.'});
 const closed=validateProgress({...base,text:'Encerramento.',stage:'close',closingSummary:'Você tem uma abertura curta que nomeia as duas entregas, reconhece a mudança de formato perto do prazo sem tratá-la como causa e convida a leitura do seu par.',nextStep:'O próximo passo fica com você: adaptar essa abertura ao seu tom, mantendo separadas a coincidência temporal e a atribuição de causa.',delivery:null,authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''}},profile,turns,{number:4});
 assert.equal(closed.progress.stage,'close');assert.doesNotMatch(closed.text,/\?/);assert.match(closed.text,/Podemos retomar o próximo passo em uma nova conversa/);
});
test('Abertura direta não transforma negativa, pedido citado ou roteiro completo em autorização',()=>{
 const fact='Em duas entregas, os dados chegaram depois do prazo.';
 const opening='Quero conversar sobre as duas entregas e ouvir como você lê o que aconteceu.';
 const attempt=request=>validateProgress({text:'Uma opção curta para adaptar:',stage:'explore',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',operationalClaims:[],delivery:{kind:'message',text:opening},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:1,quote:request}],basisEvidence:[{message:0,quote:fact}],examplePurpose:'Oferecer uma abertura breve para adaptação pelo líder.'}},profile,[{role:'user',content:fact},{role:'user',content:request}],{number:2});
 for(const request of ['Não quero uma abertura.','Ele perguntou se pode me dar uma abertura.','Pode me dar um roteiro completo?'])
  assert.throws(()=>attempt(request),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Adaptador envia orientação autoritativa e mapa de referências; correção inequívoca não gasta recuperação',async()=>{
 const received=[],validations=[],payloads=[];
 const input=envelope({completed:[{criterion:'FBK.facts',evidence:[{message:4,quote:leader}]}],pending:profile.diagnostic_criteria.map(c=>c.id).filter(x=>x!=='FBK.facts')});
 const p=providers([input],{received,validations,payloads});
 const r=await p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:1,max:10}});
 assert.equal(payloads.length,1);assert.deepEqual(received[0].input,input);
 assert.equal(validations[0].code,'ACCEPTED');assert.equal(validations[0].referenceNormalizations[0].resolved.message,0);
 assert.match(payloads[0].system,/ORIENTAÇÃO AUTORITATIVA/);assert.match(payloads[0].system,/não é roteiro nem sequência fixa/i);
 assert.match(payloads[0].system,/"userMessage":0,"conversationMessage":0/);
 assert(payloads[0].tools[0].input_schema.required.includes('authorship'));assert.equal(r.progress.completed[0].evidence[0].message,0);
});
test('Piloto guarda brutos, normalizações e códigos das duas recusas; falha não consome troca',async()=>{
 const state=prepareFourthRound(original,1000),store=createPilotStore(state,()=>{},FOURTH_IDENTITY);
 const scope={userId:FOURTH_IDENTITY.id,organizationId:FOURTH_IDENTITY.organizationId},session=store.open(scope);
 const values=[classify,envelope({delivery:{kind:'message',text:'Faça isso.'}}),envelope({completed:[{criterion:'FBK.facts',evidence:[{message:0,quote:'Conteúdo que não consta em nenhum relato'}]}],pending:['FBK.intent','FBK.distortion','FBK.next']})];
 const b=createPilotBudget(state.budget);
 const model=createModelProviders({client:{messages:{create:async p=>b.call(p,async()=>({stop_reason:'tool_use',content:[{type:'tool_use',name:p.tool_choice.name,input:values.shift()}],usage:{input_tokens:10,output_tokens:10}}))}},onGenerationObservation:e=>store.repository.recordGenerationObservation(scope,e),onValidationObservation:e=>store.repository.recordValidation(scope,e)});
 const service=createConversationService({repository:store.repository,...model,agentPrompts:prompts});
 await assert.rejects(service.turn(scope,{sessionId:session.id,requestId:'fictitious-failure-1',content:leader}),/INVALID_MODEL_RESPONSE/);
 assert.equal(state.session.exchangeCount,0);assert.equal(state.audit[0].outcome,'failed');assert.equal(state.audit[0].failure.code,'INVALID_MODEL_RESPONSE');
 assert.deepEqual(state.audit[0].classificationRaw,classify);
 assert.deepEqual(state.audit[0].generationAttempts.map(a=>a.validationEvents[0].code),['AUTONOMY_CONSTRAINT_FAILED','INVALID_PROGRESS_EVIDENCE']);
 assert(state.audit[0].generationAttempts[1].input.completed[0].evidence[0].quote.includes('não consta'));
 assert.equal(state.budget.charged,334833);assert.equal(state.budget.calls.length,23);assert.equal(state.budget.calls.at(-1).round,4);
 await assert.rejects(store.repository.recordValidation({userId:'alheio',organizationId:scope.organizationId},{turn:1,attempt:1,code:'ACCEPTED'}),/SCOPE_DENIED/);
});
test('Geração aceita preserva fonte corrigida e privacidade do contexto normal no fechamento',async()=>{
 const state=prepareFourthRound(original,1000),scope={userId:FOURTH_IDENTITY.id,organizationId:FOURTH_IDENTITY.organizationId};
 const store=createPilotStore(state,()=>{},FOURTH_IDENTITY),session=store.open(scope);
 const input=envelope({stage:'close',closingSummary:'Você quer nomear o retrabalho e ouvir antes de decidir mudanças; a causa continua incerta.',nextStep:'Sua elaboração pode guiar a abertura, mantendo espaço para a leitura do colega.',completed:[{criterion:'FBK.facts',evidence:[{message:4,quote:leader}]}],pending:['FBK.intent','FBK.distortion','FBK.next']});
 const service=createConversationService({repository:store.repository,classify:async()=>classify,respond:async()=>validateProgress(input,profile,messages,{number:1}),agentPrompts:prompts});
 const result=await service.turn(scope,{sessionId:session.id,requestId:'fictitious-close-1',content:leader});
 assert.equal(result.status,'closed');assert.deepEqual(Object.keys(state.session.context).sort(),['agentType','routingVersion']);
 assert.equal(state.audit[0].generation.progress.referenceNormalizations[0].raw.message,4);
 assert.equal(state.audit[0].generation.progress.completed[0].evidence[0].message,0);
 assert.equal(state.audit[0].generation.progress.authorship.supportMode,'explore');
});
test('Rodada 4 não transforma desistência em fechamento fictício nem perde custo ou arquivos anteriores',()=>{
 const s=prepareFourthRound(original,1000);
 assert.equal(s.version,'0.3.3');assert.equal(s.round,4);assert.equal(s.budget.charged,334413);assert.equal(s.budget.calls.length,20);
 assert.equal(s.archivedRounds.length,3);assert.deepEqual(s.archivedRounds[2].original,original);
 assert.equal(s.archivedRounds[2].original.session.status,'active');assert.equal(s.archivedRounds[2].endedBy,'abandonment-reported-by-user');
 assert.equal(s.session,undefined);assert.deepEqual(s.audit,[]);assert.equal(prepareFourthRound(s,9000000),s);assert.equal(s.expiresAt,7201000);
 const store=createPilotStore(s,()=>{},FOURTH_IDENTITY),scope={userId:FOURTH_IDENTITY.id,organizationId:FOURTH_IDENTITY.organizationId};
 const opened=store.open(scope);assert.equal(opened.exchangeCount,0);assert.deepEqual(opened.messages,[]);
 assert.throws(()=>store.open({userId:THIRD_IDENTITY.id,organizationId:THIRD_IDENTITY.organizationId}),/SCOPE_DENIED/);
 const b=createPilotBudget(s.budget);assert.equal(b.snapshot().remainingUSD,4.665587);assert.equal(b.snapshot().capUSD,5);
 const calls=s.budget.calls.length;s.budget.charged=4999999;let sent=false;
 return assert.rejects(b.call({model:'claude-sonnet-4-5',max_tokens:2200,messages:[]},async()=>{sent=true;}),/BUDGET_LIMIT/).then(()=>{
  assert.equal(sent,false);assert.equal(s.budget.charged,4999999);assert.equal(s.budget.calls.length,calls);
 });
});
test('Proteção física pertinente não é subordinada à regra de autoria do Feedback',async()=>{
 const state={},scope={userId:FOURTH_IDENTITY.id,organizationId:FOURTH_IDENTITY.organizationId},store=createPilotStore(state,()=>{},FOURTH_IDENTITY),session=store.open(scope);
 const threat='Ele está ameaçando atacar a equipe com uma faca agora.';
 const service=createConversationService({repository:store.repository,classify:async()=>({...classify,immediateExternalRisk:true,riskKind:'physical',riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:threat,riskImpactEvidence:threat}),respond:async()=>{throw Error('SHOULD_NOT_GENERATE');},agentPrompts:prompts});
 const r=await service.turn(scope,{sessionId:session.id,requestId:'fictitious-physical-1',content:threat});
 assert.equal(r.route.agent,'CRS');assert.match(r.text,/não entre em confronto nem tente conter ou separar fisicamente/);
 assert.equal(state.audit[0].version,ROUTING_VERSION);assert.equal(r.exchangeCount,1);
 assert.equal(state.audit[0].outcome,'completed');assert.equal(state.audit[0].analysis.riskImpactEvidence,threat);
});
