'use strict';
// Fully injected SDK; the real EX05 campaign is never opened by the tests.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const {spawn}=require('node:child_process');
const replay=require('../generated-artifacts/ex05-2/fictional-replay.json');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {resolveContract}=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
const {decideRoute}=require('../artifacts/api-server/src/lib/functional-policy.cjs');
const {readAnalysis}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {inspectOperation,operationMessages}=require('../artifacts/api-server/src/lib/ex05-operation-recovery.cjs');
const {createPilotPersistence}=require('../artifacts/api-server/src/lib/pilot-persistence.cjs');
const {admitIndependentCase}=require('../artifacts/api-server/src/lib/ex05-operation-recovery.cjs');
const {validateMethodologicalFidelity}=require('../artifacts/api-server/src/lib/methodological-fidelity.cjs');
const contract=resolveContract(),profile=contract.agents.find(a=>a.id==='FBK'),l26=replay['L26-T03-b'];
const api=Module.createRequire(path.resolve('artifacts/api-server/package.json'));
const built=api('esbuild').buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
const filename=path.resolve('artifacts/api-server/ex05-recovery-test.cjs'),mod=new Module(filename,module);
mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(built.outputFiles[0].text,filename);
function provider(values) {
 const calls=[],events=[],observations=[];
 const p=mod.exports.createModelProviders({onGenerationObservation:e=>observations.push(e),onValidationObservation:e=>events.push(e),client:{messages:{create:async payload=>{
  calls.push(payload);assert(values.length>0,'Unexpected model invocation');
  const value=structuredClone(values.shift());
  const input=payload.tool_choice.name==='revisar_exemplo'&&value.delivery?{text:value.delivery.text}:value;
  return {stop_reason:'tool_use',content:[{type:'tool_use',name:payload.tool_choice.name,input}],usage:{input_tokens:0,output_tokens:0}};
 }}}});
 return {p,calls,events,observations};
}
function corrected() {
 return {...structuredClone(l26.attempts[0]),text:'Os episódios observados são a base; esta é uma opção de abertura para você adaptar.',
  completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),
  delivery:{kind:'message',text:'Quero conversar sobre as interrupções nas reuniões e ouvir sua leitura sobre esses episódios.'},
  authorship:{...structuredClone(l26.attempts[0].authorship),approachEvidence:[]}};
}
test('Capacidade operacional: 20 falhas ficam limitadas, correções intactas e nenhum custo no 21º envio',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createPilotDelivery}=require('../artifacts/api-server/src/lib/pilot-delivery.cjs');
 const {createConversationService,MAX_OPERATIONAL_INPUTS}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId},state={budget:{charged:700,calls:[]}};
 const store=createPilotStore(state),session=store.open(scope),delivery=createPilotDelivery(state,()=>{});
 let calls=0;
 const service=createConversationService({repository:store.repository,agentPrompts:{},respond:async()=>assert.fail('generation not expected'),
  classify:async()=>{calls++;state.budget.charged+=100;throw Error('MISSING_CLASSIFICATION');}});
 for(let i=0;i<MAX_OPERATIONAL_INPUTS;i++){
  const input={sessionId:session.id,requestId:'capacity-'+String(i).padStart(3,'0'),content:'Correção literal '+i+': apenas retrabalho confirmado.'};
  delivery.begin(input,0);
  await assert.rejects(()=>service.turn(scope,input),e=>e.code==='INVALID_MODEL_RESPONSE');
  delivery.finish(input.requestId,'INVALID_MODEL_RESPONSE');
 }
 assert.equal(state.session.exchangeCount,0);assert.equal(calls,20);
 assert.equal(Object.keys(state.session.context.inputReceipts).length,20);
 assert.equal(state.session.context.messages.length,20);
 assert.equal(state.session.context.messages.at(-1).content,'Correção literal 19: apenas retrabalho confirmado.');
 const before=JSON.stringify(state);
 for(let i=0;i<4;i++){
  const next={sessionId:session.id,requestId:'capacity-denied-'+i,content:'Não apague minha correção.'};
  assert.throws(()=>delivery.begin(next,0),e=>e.code==='OPERATIONAL_CAPACITY_REACHED');
  await assert.rejects(()=>service.turn(scope,next),e=>e.code==='OPERATIONAL_CAPACITY_REACHED');
 }
 assert.equal(JSON.stringify(state),before);assert.equal(calls,20);assert.equal(state.budget.charged,2700);
 const old={sessionId:session.id,requestId:'capacity-019',content:'Correção literal 19: apenas retrabalho confirmado.'};
 assert.equal(delivery.begin(old,0).replay,true);
 await assert.rejects(()=>service.turn(scope,old),e=>e.code==='REQUEST_ALREADY_SUBMITTED');
 await assert.rejects(()=>service.turn(scope,{...old,content:'Conteúdo diferente.'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
 assert.equal(JSON.stringify(state),before);
});
test('Capacidade operacional: 64 KiB UTF-8 exatos, sem corte de fatos ou geração após o limite',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createConversationService,MAX_OPERATIONAL_INPUT_BYTES}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId},state={};
 const store=createPilotStore(state),session=store.open(scope);let calls=0;
 const service=createConversationService({repository:store.repository,agentPrompts:{},
  classify:async()=>{calls++;throw Error('MISSING_CLASSIFICATION');},respond:async()=>assert.fail('unexpected')});
 const content='é'.repeat(4096);
 for(let i=0;i<8;i++)await assert.rejects(()=>service.turn(scope,{sessionId:session.id,requestId:'byte-limit-'+i,content}),e=>e.code==='INVALID_MODEL_RESPONSE');
 assert.equal(state.session.context.messages.reduce((n,m)=>n+Buffer.byteLength(m.content),0),MAX_OPERATIONAL_INPUT_BYTES);
 assert(state.session.context.messages.every(m=>m.content===content));
 const before=JSON.stringify(state);
 await assert.rejects(()=>service.turn(scope,{sessionId:session.id,requestId:'bytes-denied',content:'x'}),e=>e.code==='OPERATIONAL_CAPACITY_REACHED');
 assert.equal(calls,8);assert.equal(state.session.exchangeCount,0);assert.equal(JSON.stringify(state),before);
});
// PostgreSQL repository with an injected, in-memory SQL transport only. No DB connection.
function operationalPgFixture(){
 const {createPostgresRepository}=require('../artifacts/api-server/src/lib/private-history-repository.cjs');
 const row={id:'synthetic-session',context:{},status:'active',exchange_count:0};
 const prefs={enabled:false,notice_version:null,revision:0},queries=[],records=[];
 const scope={userId:'synthetic-user',organizationId:'synthetic-org'};
 const query=async(sql,v=[])=>{
  queries.push(sql);
  const result=rows=>({rows,rowCount:rows.length});
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('INSERT INTO prioris_history_preferences'))return result([]);
  assert.equal(v[0],scope.userId);assert.equal(v[1],scope.organizationId);
  if(sql.startsWith('SELECT enabled,notice_version,revision'))return result([{...prefs}]);
  if(sql.startsWith('SELECT content_hash')||sql.startsWith('SELECT 1 FROM prioris_completed_requests')||sql.startsWith('SELECT h.record'))return result([]);
  if(sql.startsWith('SELECT id,context,status,exchange_count')||sql.startsWith('SELECT context,status,exchange_count'))return result([structuredClone(row)]);
  if(sql.startsWith('SELECT s.id')){
   assert(sql.includes("s.status='active'")&&sql.includes('p.revision::text=$5')&&sql.includes("->>'status'='processing'"));
   return result(row.status==='active'&&row.exchange_count===v[3]&&String(prefs.revision)===v[4]&&row.context?.inputReceipts?.[v[5]]?.status==='processing'&&row.context.inputReceipts[v[5]].executionToken===v[6]?[{id:row.id}]:[]);
  }
  if(sql.startsWith('UPDATE prioris_history_preferences')){
   prefs.revision++;prefs.enabled=sql.includes('SET enabled=false')?false:v[2];prefs.notice_version=prefs.enabled?v[3]:null;return result([]);
  }
  if(sql.startsWith('UPDATE sessions SET context=NULL')){row.context=null;row.status='closed';return result([]);}
  if(sql.startsWith('DELETE FROM prioris_')){records.length=0;return result([]);}
  if(sql.startsWith('UPDATE sessions SET context=jsonb_set')){
   if(row.status==='active'&&row.context?.inputReceipts?.[v[3]]?.status==='processing'&&row.context.inputReceipts[v[3]].executionToken===v[4])row.context.inputReceipts[v[3]].status='failed';
   return result([]);
  }
  if(sql.startsWith('UPDATE sessions SET context=$4::jsonb')){
   if(sql.includes('exchange_count=$8')&&(row.status!=='active'||row.exchange_count!==v[7]))return result([]);
   if(sql.includes("->>'executionToken'=$9")&&(row.context?.inputReceipts?.[v[9]]?.status!=='processing'||row.context.inputReceipts[v[9]].executionToken!==v[8]))return result([]);
   row.context=JSON.parse(v[3]);if(sql.includes('agent_type=$5')){row.status=v[5];row.exchange_count=v[6];}
   return result([{id:row.id}]);
  }
  if(sql.startsWith('INSERT INTO prioris_private_history')){records.push(JSON.parse(v[3]));return result([]);}
  if(sql.startsWith('INSERT INTO prioris_completed_requests'))return result([]);
  assert.fail('Unexpected SQL shape');
 };
 const repo=createPostgresRepository({query,connect:async()=>({query,release(){}})});
 return {repo,row,prefs,scope,queries,records};
}
test('Capacidade operacional: apagamento durante classificação impede geração e não ressuscita contexto',async()=>{
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const f=operationalPgFixture();let release,entered;
 const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let generation=0;
 const service=createConversationService({repository:f.repo,agentPrompts:{FBK:'Simulado'},
  classify:async()=>{entered();await gate;return {scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,decisionSufficientlyClear:true,ownRecurrenceReported:false};},
  respond:async()=>{generation++;return 'Resposta não autorizada.';}});
 const operation=service.turn(f.scope,{sessionId:f.row.id,requestId:'erase-during-classify',content:'Correção a apagar.'});
 await started;await f.repo.eraseHistory(f.scope);release();
 await assert.rejects(()=>operation,e=>e.code==='CONVERSATION_CHANGED');
 assert.equal(generation,0);assert.equal(f.row.context,null);assert.equal(f.row.status,'closed');
 assert.equal(f.row.exchange_count,0);assert.deepEqual(f.records,[]);
});
const interruptedClassification={scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,decisionSufficientlyClear:true,ownRecurrenceReported:false};
test('Interrupção focal: SIGKILL depois da admissão, novo processo retoma sem repetir chamada nem reduzir reserva',async()=>{
 const {spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iai-receipt-kill-')),file=path.join(dir,'state.json');
 const base=path.resolve('artifacts/api-server/src/lib');
 const budget={charged:900000,calls:[{status:'uncertain-held',reservedMicroUSD:900000}]};
 fs.writeFileSync(file,JSON.stringify({budget}));
 const common=`const {createPilotPersistence}=require(${JSON.stringify(base+'/pilot-persistence.cjs')});const {createPilotStore,IDENTITY}=require(${JSON.stringify(base+'/pilot-store.cjs')});const {createPilotDelivery}=require(${JSON.stringify(base+'/pilot-delivery.cjs')});const {createConversationService}=require(${JSON.stringify(base+'/conversation-service.cjs')});const state={};const p=createPilotPersistence(process.argv[1],state);const release=p.acquireRequest();const store=createPilotStore(state,p.save);const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId};const session=store.open(scope);const delivery=createPilotDelivery(state,p.save);`;
 const first=spawn(process.execPath,['-e',common+`(async()=>{delivery.begin({sessionId:session.id,requestId:'killed-request',content:'Correção literal antes da interrupção.'},0);await store.repository.recordInput(scope,{sessionId:session.id,requestId:'killed-request',content:'Correção literal antes da interrupção.',contentHash:'original-fictional-hash',expectedCount:0,settingsRevision:'pilot-history-off'});console.log('READY');setInterval(()=>{},1000);})().catch(()=>process.exit(9));`,file],{stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{first.stdout.once('data',resolve);first.once('error',reject);first.once('exit',()=>reject(Error('worker exited before admission')));});
  const {createPilotPersistence}=require('../artifacts/api-server/src/lib/pilot-persistence.cjs');
  const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
  const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
  const loaded={},p=createPilotPersistence(file,loaded),store=createPilotStore(loaded,p.save);
  const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId};let calls=0;
  assert.equal(p.requestActive(),true);
  const service=createConversationService({repository:store.repository,agentPrompts:{FBK:'Simulado'},classify:async()=>{calls++;return interruptedClassification;},respond:async()=>{calls++;return 'Simulado.';}});
  await assert.rejects(()=>service.turn(scope,{sessionId:loaded.session.id,requestId:'active-denied',content:'Novo envio.'}),e=>e.code==='TURN_IN_PROGRESS');
  assert.equal(calls,0);
  const exit=new Promise(r=>first.once('exit',r));first.kill('SIGKILL');await exit;
  const run=spawnSync(process.execPath,['-e',common+`(async()=>{delivery.recoverRestart();state.fakeCalls={classify:0,generation:0};const service=createConversationService({repository:store.repository,agentPrompts:{FBK:'Simulado'},classify:async()=>{state.fakeCalls.classify++;return ${JSON.stringify(interruptedClassification)};},respond:async()=>{state.fakeCalls.generation++;return 'Qual parte da sua abordagem você quer esclarecer?';}});const input={sessionId:session.id,requestId:'resumed-request',content:'Minha correção adicional, sem apagar a anterior.'};delivery.begin(input,0);await service.turn(scope,input);const replay=await service.turn(scope,input);if(!replay.replayed)throw Error('missing replay');release();console.log('DONE');})().catch(e=>{console.error(e.code||e.message);process.exitCode=9});`,file],{encoding:'utf8',timeout:20000});
  assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/DONE/);
  const after=JSON.parse(fs.readFileSync(file));
  assert.deepEqual(after.budget,budget);assert.deepEqual(after.fakeCalls,{classify:1,generation:1});
  assert.equal(after.session.exchangeCount,1);
  assert.equal(after.session.context.inputReceipts['killed-request'].status,'interrupted_unconfirmed');
  assert.equal(after.session.context.inputReceipts['killed-request'].recovery.automaticRetry,false);
  assert.equal(after.session.context.messages[0].content,'Correção literal antes da interrupção.');
  assert.equal(after.session.context.messages.filter(m=>m.role==='assistant').length,1);
  const foreign=createPilotStore(after);
  await assert.rejects(()=>createConversationService({repository:foreign.repository,agentPrompts:{},classify:async()=>assert.fail('cross-tenant generation'),respond:async()=>assert.fail('cross-tenant generation')}).turn({userId:'another-user',organizationId:'another-org'},{sessionId:after.session.id,requestId:'foreign-denied',content:'Acesso indevido.'}),e=>e.code==='SESSION_NOT_FOUND');
 }finally{if(first.exitCode===null&&first.signalCode===null)first.kill('SIGKILL');fs.rmSync(dir,{recursive:true,force:true});}
});
test('Interrupção focal: recibo sem origem verificável informa saída preservável; apagamento impede resultado antigo',async()=>{
 const {createConversationService,RECOVERY_REQUIRED_MESSAGE}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const f=operationalPgFixture();let calls=0;
 f.row.context={messages:[{role:'user',content:'Fala legada intacta.'}],inputReceipts:{'legacy-request':{status:'processing',contentHash:'legacy'}}};
 const service=createConversationService({repository:f.repo,agentPrompts:{},classify:async()=>{calls++;},respond:async()=>{calls++;}});
 const before=JSON.stringify(f.row);
 await assert.rejects(()=>service.turn(f.scope,{sessionId:f.row.id,requestId:'unknown-denied',content:'Não repetir.'}),e=>e.code==='RECOVERY_REQUIRED');
 assert.equal(JSON.stringify(f.row),before);assert.equal(calls,0);
 assert.match(RECOVERY_REQUIRED_MESSAGE,/preservado/);assert.match(RECOVERY_REQUIRED_MESSAGE,/encerramento\/apagamento/);
 await f.repo.eraseHistory(f.scope);
 const stale=await f.repo.commitTurn(f.scope,{sessionId:f.row.id,requestId:'legacy-request',settingsRevision:'0',executionToken:'old',context:{messages:[{role:'assistant',content:'Não ressuscitar.'}]}});
 assert.equal(stale,false);assert.equal(f.row.context,null);assert.equal(f.row.status,'closed');
});
test('Interrupção focal: resposta atrasada não sobrescreve continuação mesmo antes de incrementar troca',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const state={},store=createPilotStore(state),scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId},session=store.open(scope);
 let release,entered;const wait=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const service=createConversationService({repository:store.repository,agentPrompts:{FBK:'Simulado'},classify:async()=>interruptedClassification,respond:async()=>{entered();await wait;return 'Resposta atrasada.';}});
 const old=service.turn(scope,{sessionId:session.id,requestId:'old-response',content:'Fala antiga.'});await started;
 // Simulates a fenced continuation, not permission to declare a live owner dead.
 const oldToken=state.session.context.inputReceipts['old-response'].executionToken;
 state.session.context.inputReceipts['old-response'].status='interrupted_unconfirmed';
 await store.repository.recordInput(scope,{sessionId:session.id,requestId:'new-response',content:'Correção mais recente.',contentHash:'new',expectedCount:0,settingsRevision:'pilot-history-off'});
 const before=structuredClone(state.session.context);
 const stale=await store.repository.commitTurn(scope,{sessionId:session.id,requestId:'old-response',executionToken:oldToken,expectedCount:0,settingsRevision:'pilot-history-off',context:{messages:[{role:'assistant',content:'Sobrescrever.'}]},status:'active',nextCount:1});
 assert.equal(stale,false);
 await assert.rejects(()=>store.repository.recordGenerationObservation(scope,{sessionId:session.id,requestId:'old-response',executionToken:oldToken,turn:1,attempt:1}),e=>e.code==='CONVERSATION_CHANGED');
 release();await assert.rejects(()=>old,e=>e.code==='CONVERSATION_CHANGED');
 assert.deepEqual(state.session.context,before);assert.equal(state.session.exchangeCount,0);
 assert.equal(state.session.context.messages.at(-1).content,'Correção mais recente.');
 const newToken=state.session.context.inputReceipts['new-response'].executionToken;
 state.session.status='closed';state.session.context=null;
 const afterErasure=await store.repository.commitTurn(scope,{sessionId:session.id,requestId:'new-response',executionToken:newToken,expectedCount:0,settingsRevision:'pilot-history-off',context:{messages:[{role:'assistant',content:'Não restaurar após apagamento.'}]},status:'active',nextCount:1});
 assert.equal(afterErasure,false);assert.equal(state.session.context,null);assert.equal(state.session.status,'closed');
});
test('Interrupção focal: constructor e toString são envios próprios com replay e conflitos sem geração duplicada',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createPilotDelivery}=require('../artifacts/api-server/src/lib/pilot-delivery.cjs');
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const state={},store=createPilotStore(state),scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId},session=store.open(scope),delivery=createPilotDelivery(state,()=>{});
 let calls=0;
 const service=createConversationService({repository:store.repository,agentPrompts:{FBK:'Simulado'},classify:async()=>{calls++;return interruptedClassification;},respond:async()=>{calls++;return 'Como você pretende abordar essa conversa?';}});
 for(const id of ['constructor','toString']){
  const input={sessionId:session.id,requestId:id,content:'Envio fictício '+id+'.'};
  assert.equal(delivery.begin(input,0).replay,false);
  await service.turn(scope,input);
  assert.equal((await service.turn(scope,input)).replayed,true);
  assert.equal(delivery.begin(input,0).replay,true);
  await assert.rejects(()=>service.turn(scope,{...input,content:'Conteúdo conflitante.'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
  assert.throws(()=>delivery.begin({...input,content:'Conteúdo conflitante.'},0),/IDEMPOTENCY_CONFLICT/);
  assert(Object.hasOwn(state.requests,id));assert(Object.hasOwn(state.session.context.inputReceipts,id));
 }
 assert.equal(calls,4);assert.equal(state.session.exchangeCount,2);
 const content='Falha fictícia já registrada.';
 const legacy={session:{id:'legacy-session',status:'active',context:{}},audit:[{requestId:'constructor',inputHash:require('node:crypto').createHash('sha256').update(content).digest('hex'),outcome:'failed',failure:{code:'INVALID_MODEL_RESPONSE'},messages:[{role:'user',content}]}]};
 const prior=createPilotDelivery(legacy,()=>assert.fail('Replay não deve gravar nem gerar'));
 assert.equal(prior.view().deliveries[0].requestId,'constructor');
 assert.equal(prior.begin({sessionId:'legacy-session',requestId:'constructor',content},0).replay,true);
 assert.throws(()=>prior.begin({sessionId:'legacy-session',requestId:'constructor',content:'Conflito.'},0),/IDEMPOTENCY_CONFLICT/);
});
test('Capacidade operacional: apagamento e novo consentimento durante resposta não restauram envio antigo',async()=>{
 const {createConversationService,NOTICE_VERSION}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const f=operationalPgFixture();let release,entered;
 const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const service=createConversationService({repository:f.repo,agentPrompts:{FBK:'Simulado'},
  classify:async()=>({scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,decisionSufficientlyClear:true,ownRecurrenceReported:false}),
  respond:async()=>{entered();await gate;return 'Resposta antiga não pode ser exibida.';}});
 const operation=service.turn(f.scope,{sessionId:f.row.id,requestId:'erase-during-answer',content:'Envio antigo.'});
 await started;await f.repo.eraseHistory(f.scope);await f.repo.setHistorySettings(f.scope,true,NOTICE_VERSION);release();
 await assert.rejects(()=>operation,e=>e.code==='CONVERSATION_CHANGED');
 assert.equal(f.row.context,null);assert.equal(f.row.exchange_count,0);assert.deepEqual(f.records,[]);
});
test('Capacidade operacional: mudança de consentimento invalida geração posterior e admissão com revisão antiga',async()=>{
 const {createConversationService,NOTICE_VERSION}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const f=operationalPgFixture();await f.repo.setHistorySettings(f.scope,true,NOTICE_VERSION);
 let release,entered,generation=0;
 const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const service=createConversationService({repository:f.repo,agentPrompts:{FBK:'Simulado'},
  classify:async()=>{entered();await gate;return {scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,decisionSufficientlyClear:true,ownRecurrenceReported:false};},
  respond:async()=>{generation++;return 'Resposta simulada.';}});
 const operation=service.turn(f.scope,{sessionId:f.row.id,requestId:'consent-during-classify',content:'Correção operacional não é histórico pessoal.'});
 await started;await f.repo.setHistorySettings(f.scope,false,null);release();
 await assert.rejects(()=>operation,e=>e.code==='CONVERSATION_CHANGED');assert.equal(generation,0);
 assert.equal(f.row.exchange_count,0);assert.equal(f.records.length,0);
 await assert.rejects(()=>f.repo.recordInput(f.scope,{sessionId:f.row.id,requestId:'stale-settings',settingsRevision:'1',expectedCount:0,contentHash:'fake',content:'Não admitir.'}),e=>e.code==='CONVERSATION_CHANGED');
});
test('Capacidade operacional: fechamento consentido remove recibos; abandono fictício limpa contexto sem mexer em auditoria e reserva',async()=>{
 const {createConversationService,NOTICE_VERSION}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const {abandonPilotConversation}=require('../artifacts/api-server/src/lib/pilot-next-round.cjs');
 const f=operationalPgFixture();await f.repo.setHistorySettings(f.scope,true,NOTICE_VERSION);
 const service=createConversationService({repository:f.repo,agentPrompts:{FBK:'Simulado'},
  classify:async()=>({scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,decisionSufficientlyClear:true,ownRecurrenceReported:false}),
  respond:async()=> 'Uma conclusão simulada, sem afirmar execução. [ENCERRAR]'});
 const r=await service.turn(f.scope,{sessionId:f.row.id,requestId:'close-operational',content:'Tenho clareza suficiente.'});
 assert.equal(r.status,'closed');assert.equal(f.row.context.inputReceipts,undefined);assert.equal(f.records.length,1);
 const state={round:1,expiresAt:100,session:{id:'fake',status:'active',context:{messages:[{role:'user',content:'Correção preservada em auditoria.'}],inputReceipts:{one:{status:'failed'}}}},audit:[{kind:'immutable-fixture'}],budget:{charged:1000,calls:[{status:'uncertain',reservedMicroUSD:900}]}};
 const budget=JSON.stringify(state.budget),audit=JSON.stringify(state.audit[0]);
 abandonPilotConversation(state,{expectedRound:1,sessionId:'fake',now:1},()=>{});
 assert.equal(state.session.status,'closed');assert.equal(state.session.context.messages,undefined);assert.equal(state.session.context.inputReceipts,undefined);
 assert.equal(JSON.stringify(state.budget),budget);assert.equal(JSON.stringify(state.audit[0]),audit);
 assert.equal(state.audit.at(-1).conversationSnapshot.messages[0].content,'Correção preservada em auditoria.');
 assert.equal(state.abandonment.approval,false);
});
test('Recuperação focal: falha conserva correção, recarga, isolamento e idempotência sem completar troca',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId};
 let disk;const state={};let store=createPilotStore(state,()=>{disk=JSON.stringify(state);});
 const session=store.open(scope),seen=[];let calls=0,fail=true;
 const classify=async({messages})=>{seen.push(structuredClone(messages));return {
  scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,
  immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,
  decisionSufficientlyClear:true,ownRecurrenceReported:false};};
 const respond=async()=>{calls++;if(fail)throw Error('UNSUPPORTED_FACT');return 'Uma resposta simulada aceita.';};
 const service=()=>createConversationService({repository:store.repository,classify,respond,agentPrompts:{FBK:'Simulado'}});
 const input={sessionId:session.id,requestId:'focal-failed-01',content:'Quero preparar a conversa; corrigi: só confirmei retrabalho.'};
 await assert.rejects(()=>service().turn(scope,input),e=>e.code==='INVALID_MODEL_RESPONSE');
 assert.equal(state.session.exchangeCount,0);
 // Reload repository/service from persisted synthetic state, not in-memory busy.
 store=createPilotStore(JSON.parse(disk),()=>{});const reloaded=service();
 await assert.rejects(()=>reloaded.turn(scope,input),e=>e.code==='REQUEST_ALREADY_SUBMITTED');
 assert.equal(calls,1);
 await assert.rejects(()=>reloaded.turn({...scope,userId:'other'}, {...input,requestId:'focal-other-01'}),e=>e.code==='SESSION_NOT_FOUND');
 fail=false;
 const result=await reloaded.turn(scope,{...input,requestId:'focal-retry-02',content:'Não assuma impacto no planejamento; pode retomar?'});
 assert.equal(result.exchangeCount,1);assert.equal(calls,2);
 assert.deepEqual(seen.at(-1).map(m=>m.content),[input.content,'Não assuma impacto no planejamento; pode retomar?']);
 const saved=await store.repository.getSession(scope,session.id);
 assert.deepEqual(saved.context.messages.map(m=>m.role),['user','user','assistant']);
 const replayed=await reloaded.turn(scope,{...input,requestId:'focal-retry-02',content:'Não assuma impacto no planejamento; pode retomar?'});
 assert.equal(replayed.replayed,true);assert.equal(calls,2);
});
test('Recuperação focal: pergunta ao líder e ao interlocutor não somam destinatários',async()=>{
 const v=corrected();v.text='Os episódios são o ponto de partida. O que você quer esclarecer?';
 v.delivery.text='Quero conversar sobre as interrupções nas reuniões. Como você vê esses episódios?';
 const h=provider([v]);
 const r=await h.p.respond({agent:'FBK',system:profile.prompt,messages:l26.messages,history:[],turn:{number:3,max:10}});
 assert.equal(h.calls.length,1);assert.equal((r.text.match(/\?/g)||[]).length,2);
});
test('Recuperação focal: duas perguntas ao mesmo destinatário continuam recusadas',async()=>{
 for(const target of ['leader','interlocutor']){
  const v=corrected();
  if(target==='leader')v.text='Os episódios são a base. O que quer esclarecer? Como pretende abordar?';
  else v.delivery.text='Quero conversar sobre as interrupções nas reuniões. Como vê isso? O que mudaria?';
  const h=provider([v,v]);
  const result=await h.p.respond({agent:'FBK',system:profile.prompt,messages:l26.messages,history:[],turn:{number:3,max:10}});
  assert(h.events.some(e=>e.phase==='presentation'&&e.code==='RESPONSE_CONSTRAINT_FAILED'));
  assert.equal(result.progress.evidenceStatus,'Recovery; no diagnosis asserted');
  assert(!result.text.includes(target==='leader'?v.text:v.delivery.text));
  assert.equal(h.calls.length,2);
 }
});
test('Recuperação focal: fechamento não permite pergunta ao líder nem no exemplo',async()=>{
 for(const target of ['leader','interlocutor']){
  const v=corrected();v.stage='close';
  v.closingSummary='Os episódios relatados e sua elaboração continuam sendo a base da conversa.';
  v.nextStep='Retomar sua abordagem a partir dos fatos relatados.';
  if(target==='leader')v.nextStep='O que você pretende rever nessa abordagem?';
  else v.delivery.text='Quero conversar sobre as interrupções nas reuniões. Como vê isso?';
  assert.throws(()=>validateProgress(v,profile,l26.messages,{number:10}),/INVALID_CLOSURE/);
 }
});
test('Recuperação focal: escrita falha impede geração; entrada ativa e sessão encerrada continuam bloqueadas',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId},state={};
 let broken=false,calls=0;
 const store=createPilotStore(state,()=>{if(broken)throw Object.assign(Error('simulated storage failure'),{code:'EIO'});});
 const session=store.open(scope),input={sessionId:session.id,requestId:'write-fail-01',content:'Correção fictícia.'};
 const service=()=>createConversationService({repository:store.repository,classify:async()=>{calls++;throw Error('not reached');},respond:async()=>{throw Error('not reached');},agentPrompts:{}});
 broken=true;
 await assert.rejects(()=>service().turn(scope,input),e=>e.code==='STORAGE_UNAVAILABLE');
 assert.equal(calls,0);assert.deepEqual(state.session.context,{});
 broken=false;
 await store.repository.recordInput(scope,{...input,contentHash:'synthetic',expectedCount:0});
 await assert.rejects(()=>service().turn(scope,{...input,requestId:'concurrent-02'}),e=>e.code==='TURN_IN_PROGRESS');
 assert.equal(calls,0);
 state.session.status='closed';
 await assert.rejects(()=>service().turn(scope,{...input,requestId:'closed-case-03'}),e=>e.code==='SESSION_CLOSED');
});
test('Recuperação focal: erro de classificação conserva envio, consentimento desligado e fechamento apaga contexto operacional',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId},state={};
 const store=createPilotStore(state),session=store.open(scope);let fail=true,seen;
 const service=createConversationService({repository:store.repository,agentPrompts:{FBK:'Simulado'},
  classify:async ({messages,history})=>{seen=messages;assert.deepEqual(history,[]);if(fail)throw Error('MISSING_CLASSIFICATION');
   return {scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,decisionSufficientlyClear:true,ownRecurrenceReported:false};},
  respond:async()=> 'Retome sua elaboração sem presumir efeitos não relatados. [ENCERRAR]'});
 const input={sessionId:session.id,requestId:'class-fail-01',content:'Só retrabalho foi confirmado.'};
 await assert.rejects(()=>service.turn(scope,input),e=>e.code==='INVALID_MODEL_RESPONSE');
 assert.equal(state.session.exchangeCount,0);assert.equal(state.session.context.messages.length,1);
 const before=JSON.stringify(state);
 await assert.rejects(()=>service.turn({...scope,organizationId:'other-org'},{...input,requestId:'org-other-01'}),e=>e.code==='SESSION_NOT_FOUND');
 assert.equal(JSON.stringify(state),before);
 fail=false;
 const result=await service.turn(scope,{...input,requestId:'class-retry-02',content:'Minha correção permanece; já tenho clareza para encerrar.'});
 assert.equal(seen.length,2);assert.equal(result.exchangeCount,1);assert.equal(result.status,'closed');
 assert.equal(result.historyUsed,false);assert.equal(state.session.context.messages,undefined);
 assert.equal(state.session.context.inputReceipts,undefined);
 await assert.rejects(()=>service.turn(scope,{...input,requestId:'after-close-03'}),e=>e.code==='SESSION_CLOSED');
});
test('Replay L26 mantém as duas recusas e identifica o motivo específico, sem texto privado no diagnóstico',()=>{
 const expected=['EXAMPLE_TOO_LONG','IMPERATIVE_PRESENTATION'];
 l26.attempts.forEach((v,i)=>assert.throws(()=>validateProgress(v,profile,l26.messages,{number:3}),
  e=>e.message==='AUTONOMY_CONSTRAINT_FAILED'&&e.validationReason===expected[i]));
});
test('Recuperação usa motivo específico e aceita só a abertura opcional solicitada, sem abordagem prévia obrigatória',async()=>{
 const h=provider([l26.attempts[0],corrected()]);
 const r=await h.p.respond({agent:'FBK',system:profile.prompt,messages:l26.messages,history:[],turn:{number:3,max:10}});
 assert.equal(h.calls.length,2);assert.equal(h.events[0].code,'AUTONOMY_CONSTRAINT_FAILED');
 assert.equal(h.events[0].reason,'EXAMPLE_TOO_LONG');assert.equal(h.events[1].code,'ACCEPTED');
 assert(h.calls[1].system.includes('Razão específica: EXAMPLE_TOO_LONG'));
 assert(h.calls[1].system.includes('requestEvidence e basisEvidence literais'));
 assert.equal(r.progress.authorship.approachEvidence.length,0);assert.equal(r.progress.authorship.supportMode,'optional_example');
 assert.equal(r.text.split(corrected().delivery.text).length-1,1);
 assert(r.progress.delivery.text.trim().split(/\s+/).length<=40);
 assert.doesNotMatch(r.text,/você pode abrir|diga|comece|fecha espaço|afeta a dinâmica/i);
});
test('Pedido não libera exemplo sem fatos, longo, imperativo, retirado, com citação falsa ou efeito não relatado',()=>{
 const check=(v,m=l26.messages)=>validateProgress(v,profile,m,{number:3});
 let v=corrected();v.authorship.basisEvidence=[];assert.throws(()=>check(v),e=>e.validationReason==='FACTUAL_BASIS_MISSING');
 v=corrected();v.authorship.requestEvidence=[];assert.throws(()=>check(v),e=>e.validationReason==='EXPLICIT_REQUEST_MISSING');
 v=corrected();v.delivery.text='palavra '.repeat(41);assert.throws(()=>check(v),e=>e.validationReason==='EXAMPLE_TOO_LONG');
 v=corrected();v.text='Você pode abrir assim.';assert.throws(()=>check(v),e=>e.validationReason==='IMPERATIVE_PRESENTATION');
 assert.throws(()=>check(corrected(),[...l26.messages,{role:'user',content:'Não quero exemplos.'}]),e=>e.validationReason==='EXAMPLE_WITHDRAWN');
 v=corrected();v.authorship.requestEvidence=[{message:0,quote:'Pedido inexistente.'}];assert.throws(()=>check(v),/INVALID_PROGRESS_EVIDENCE/);
 v=corrected();v.delivery.text='Isso afetou o planejamento.';assert.throws(()=>check(v),/UNSUPPORTED_FACT/);
});
test('L24: classificador recebe a distinção temporal; observação simulada de preparação segue Feedback mesmo com fato Depois',async()=>{
 const a=replay['L24-T03-a'],future={...a.analysis,job:'prepare_message',conversationInProgress:false};
 const h=provider([future]),classified=readAnalysis(await h.p.classify({messages:a.messages,history:[],previousAgent:'IMP'}));
 assert.equal(h.calls.length,1);assert(h.calls[0].system.includes('distinga o fato relatado da conversa que o líder pretende ter'));
 assert(h.calls[0].tools[0].input_schema.properties.conversationInProgress.description.includes('Não confundir fato/crise anterior'));
 assert.equal(classified.situationState,'AFTER');
 assert.equal(decideRoute(classified,{reportedMessages:a.messages},'IMP').agent,'FBK');
 // The archived wrong observation is preserved, not rewritten as a new result.
 assert.equal(decideRoute(a.analysis,{reportedMessages:a.messages},'IMP').agent,'OTO');
 assert.equal(decideRoute({...classified,job:'compare_paths'},{reportedMessages:a.messages}).agent,'MNT');
 assert.equal(decideRoute({...classified,job:'understand_impact'},{reportedMessages:a.messages}).agent,'IMP');
 assert.equal(decideRoute({...classified,job:'conduct_live',conversationInProgress:true},{reportedMessages:a.messages}).agent,'OTO');
 assert.equal(decideRoute({...classified,job:'conduct_live'},{reportedMessages:a.messages}).mode,'clarify');
});
function campaign() {
 return {budget:{charged:600000,calls:[{status:'reserved',reservedMicroUSD:600000}]},
  operations:{one:{caseId:'L24',input:'Envio fictício.',status:'processing'}},
  cases:{L24:{session:{id:'session-a',exchangeCount:2},audit:[{sessionId:'session-a',requestId:'one',outcome:'classified'}]}}};
}
test('Consulta repetida conserva incerteza, mensagem e reserva; envio ativo/sem prova não é encerrado e outro líder é negado',()=>{
 const c=campaign(),before=JSON.stringify(c);
 assert.equal(inspectOperation(c,'L24','one').status,'processing');
 assert.equal(inspectOperation(c,'L24','one',{activeRequest:true}).status,'processing');
 for(let n=0;n<3;n++)assert.equal(inspectOperation(c,'L24','one',{activeRequest:false}).error,'RESULT_UNCONFIRMED');
 assert.equal(operationMessages(c,'L24').length,1);
 assert.throws(()=>inspectOperation(c,'L26','one',{activeRequest:false}),/SCOPE_DENIED/);
 assert.equal(JSON.stringify(c),before);
});
test('Resposta já gravada é recuperada uma vez na projeção da interface, sem geração ou alteração de contadores',()=>{
 const c=campaign(),result={text:'Resposta fictícia já concluída.',exchangeCount:3,status:'active'};
 c.cases.L24.audit[0]={...c.cases.L24.audit[0],outcome:'completed',result};
 c.cases.L24.session.exchangeCount=3;const before=JSON.stringify(c);
 for(let n=0;n<3;n++){
  const recovered=inspectOperation(c,'L24','one',{activeRequest:false});
  assert.equal(recovered.recoverySource,'committed-delivery');
  assert.equal(operationMessages(c,'L24',recovered).filter(m=>m.role==='assistant').length,1);
 }
 assert.equal(JSON.stringify(c),before);
 c.operations.one.result={...result,text:'Outra resposta conflitante.'};
 assert.equal(inspectOperation(c,'L24','one',{activeRequest:false}).error,'RECOVERY_CONFLICT');
});
test('Linux: lock de processo real ativo bloqueia; após SIGKILL recupera lock sem repetir envio nem liberar reserva',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ex05-recovery-')),file=path.join(dir,'state.json'),c=campaign();
 fs.writeFileSync(file,JSON.stringify(c));
 const child=spawn(process.execPath,['-e',`const {createPilotPersistence}=require(${JSON.stringify(path.resolve('artifacts/api-server/src/lib/pilot-persistence.cjs'))});const p=createPilotPersistence(process.argv[1],{});p.acquireRequest();process.stdout.write('READY\\n');setInterval(()=>{},1000);`,file],{stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',()=>resolve());child.once('error',reject);child.once('exit',()=>reject(Error('Child exited before readiness')));});
  const loaded={},p=createPilotPersistence(file,loaded);
  assert.equal(p.requestActive(),true);assert.throws(()=>p.acquireRequest(),/TURN_IN_PROGRESS/);
  assert.equal(inspectOperation(loaded,'L24','one',{activeRequest:true}).status,'processing');
  const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;
  const before=fs.readFileSync(file,'utf8'),release=p.acquireRequest();
  try{
   const r=inspectOperation(loaded,'L24','one',{activeRequest:false});
   assert.equal(r.error,'RESULT_UNCONFIRMED');assert.equal(r.noAutomaticRetry,true);
   assert.equal(loaded.budget.charged,600000);assert.equal(loaded.budget.calls.length,1);
   assert.equal(fs.readFileSync(file,'utf8'),before);
   assert(fs.readdirSync(path.join(dir,'lock-recovery')).length>0);
  }finally{release();}
 }finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');fs.rmSync(dir,{recursive:true,force:true});}
});
function independentFixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ex05-independent-')),file=path.join(dir,'campaign.json');
 const c=campaign();c.budget={cap:5000000,charged:590064,blocked:false,calls:[
  {round:24,model:'claude-sonnet-4-5',inputBound:92844,maxOutput:2200,reservedMicroUSD:590064,status:'reserved'}]};
 fs.writeFileSync(file,JSON.stringify(c));
 fs.writeFileSync(path.join(dir,'latest-result.json'),JSON.stringify({caseId:'L24',requestId:'one',error:'RESULT_UNCONFIRMED',noAutomaticRetry:true}));
 const p=createPilotPersistence(file,c),release=p.acquireRequest();
 const archive=path.join(dir,'lock-recovery','campaign.json.request-lock.fictional');
 fs.mkdirSync(archive,{recursive:true});
 const boot=fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
 const oldOwner={pid:2147483647,processIdentity:boot+':1',writer:'fictional-old-owner'};
 fs.writeFileSync(path.join(archive,'owner.json'),JSON.stringify(oldOwner));
 return {dir,file,c,p,archive,oldOwner,release,close(){release();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('Caso independente: término verificável e reserva integral permitem novo caso sem liberar valor nem repetir envio',()=>{
 const f=independentFixture();
 try{
  const before=JSON.stringify(f.c),result=admitIndependentCase(f.c,'L27',f.file);
  assert.equal(result.pending.length,1);assert.equal(result.pending[0].requestId,'one');
  assert.equal(result.pending[0].proof.localTerminationVerified,true);
  assert.equal(result.pending[0].proof.remoteResult,'unconfirmed');
  assert.equal(JSON.stringify(f.c),before);
  assert.equal(result.pending[0].proof.reservations[0].index,0);
  assert.equal(f.c.cases.L27,undefined);assert.equal(f.c.budget.charged,590064);
 }finally{f.close();}
});
test('Caso independente: reenvio não gera e continuação do contexto incerto permanece bloqueada',()=>{
 const f=independentFixture();
 try{
  assert.equal(inspectOperation(f.c,'L24','one',{activeRequest:false}).error,'RESULT_UNCONFIRMED');
  assert.throws(()=>admitIndependentCase(f.c,'L24',f.file),/PENDING_CASE_UNCERTAIN/);
  f.c.cases.L26={session:{id:'already-existing'}};
  assert.throws(()=>admitIndependentCase(f.c,'L26',f.file),/NEW_INDEPENDENT_CASE_REQUIRED/);
  assert.equal(f.c.budget.calls.length,1);
 }finally{f.close();}
});
test('Caso independente: proprietário original ativo continua bloqueando',()=>{
 const f=independentFixture();
 try{
  const owner=JSON.parse(fs.readFileSync(f.file+'.request-lock/owner.json','utf8'));
  fs.writeFileSync(path.join(f.archive,'owner.json'),JSON.stringify(owner));
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/PENDING_OWNER_ACTIVE/);
 }finally{f.close();}
});
test('Caso independente: origem ausente, processo não verificável e evidência ambígua não autorizam chamadas',(t)=>{
 const f=independentFixture();
 try{
  fs.writeFileSync(path.join(f.archive,'owner.json'),JSON.stringify({...f.oldOwner,processIdentity:null}));
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/RECOVERY_EVIDENCE_INSUFFICIENT/);
  fs.writeFileSync(path.join(f.archive,'owner.json'),JSON.stringify({...f.oldOwner,pid:1}));
  const read=fs.readFileSync;
  t.mock.method(fs,'readFileSync',(p,...args)=>{
   if(String(p)==='/proc/1/stat')throw Object.assign(Error('simulated permission denied'),{code:'EACCES'});
   return read(p,...args);
  });
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/PENDING_OWNER_UNVERIFIABLE/);
  t.mock.restoreAll();
  fs.writeFileSync(path.join(f.archive,'owner.json'),JSON.stringify(f.oldOwner));
  fs.writeFileSync(path.join(f.dir,'latest-result.json'),JSON.stringify({caseId:'L26',requestId:'other'}));
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/RECOVERY_EVIDENCE_INSUFFICIENT/);
  fs.writeFileSync(path.join(f.dir,'latest-result.json'),JSON.stringify({caseId:'L24',requestId:'one',error:'RESULT_UNCONFIRMED',noAutomaticRetry:true}));
  const extra=path.join(f.dir,'lock-recovery','campaign.json.request-lock.ambiguous');
  fs.mkdirSync(extra);fs.writeFileSync(path.join(extra,'owner.json'),JSON.stringify(f.oldOwner));
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/RECOVERY_EVIDENCE_INSUFFICIENT/);
 }finally{f.close();}
});
test('Caso independente: reserva abaixo do máximo ou não integralmente deduzida permanece bloqueada',()=>{
 const f=independentFixture();
 try{
  f.c.budget.calls[0].reservedMicroUSD--;
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/RESERVATION_COVERAGE_UNVERIFIED/);
  f.c.budget.calls[0].reservedMicroUSD++;f.c.budget.charged--;
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/RESERVATION_NOT_FULLY_DEDUCTED/);
  f.c.budget.charged++;f.c.budget.calls[0].maxOutput=2201;
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/RESERVATION_COVERAGE_UNVERIFIED/);
 }finally{f.close();}
});
test('Caso independente: prova persistida é reutilizável sem latest-result antigo; reserva alterada invalida a prova',()=>{
 const f=independentFixture();
 try{
  const r=admitIndependentCase(f.c,'L27',f.file);
  f.c.operations.one.independentRecovery=r.pending[0].proof;
  f.c.cases.L27={independentAdmission:{revision:r.revision,pending:['one']}};
  fs.writeFileSync(path.join(f.dir,'latest-result.json'),JSON.stringify({caseId:'L27',status:'active'}));
  assert.equal(admitIndependentCase(f.c,'L27',f.file).pending.length,1);
  assert.equal(admitIndependentCase(f.c,'L28',f.file).pending.length,1);
  assert.throws(()=>admitIndependentCase(f.c,'L24',f.file),/PENDING_CASE_UNCERTAIN/);
  f.c.budget.calls[0].reservedMicroUSD++;f.c.budget.charged++;
  assert.throws(()=>admitIndependentCase(f.c,'L28',f.file),/RESERVATION_COVERAGE_UNVERIFIED/);
 }finally{f.close();}
});
test('Caso independente: Linux real mantém exclusão entre processos antes e depois de recuperar órfão',async()=>{
 const f=independentFixture();
 // Release normally; keep only the real child owner archive in this test.
 f.release();
 f.close=function(){fs.rmSync(f.dir,{recursive:true,force:true});};
 fs.rmSync(f.archive,{recursive:true,force:true});
 const child=spawn(process.execPath,['-e',`const {createPilotPersistence}=require(${JSON.stringify(path.resolve('artifacts/api-server/src/lib/pilot-persistence.cjs'))});const p=createPilotPersistence(process.argv[1],{});p.acquireRequest();process.stdout.write('READY\\n');setInterval(()=>{},1000);`,f.file],{stdio:['ignore','pipe','pipe']});
 let release;
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('Child exited before readiness')));});
  assert.throws(()=>f.p.acquireRequest(),/TURN_IN_PROGRESS/);
  assert.throws(()=>admitIndependentCase(f.c,'L27',f.file),/REQUEST_LOCK_NOT_OWNED/);
  const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;
  release=f.p.acquireRequest();f.p.refresh();
  const before=JSON.stringify(f.c);
  assert.equal(admitIndependentCase(f.c,'L27',f.file).pending.length,1);
  const contender=spawn(process.execPath,['-e',`const {createPilotPersistence}=require(${JSON.stringify(path.resolve('artifacts/api-server/src/lib/pilot-persistence.cjs'))});try{createPilotPersistence(process.argv[1],{}).acquireRequest();process.exit(7);}catch(e){process.exit(e.code==='TURN_IN_PROGRESS'?0:8);}`,f.file],{stdio:'ignore'});
  assert.equal(await new Promise(resolve=>contender.once('exit',resolve)),0);
  assert.equal(JSON.stringify(f.c),before);assert.equal(f.c.budget.calls.length,1);
 }finally{if(release)release();if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');f.close();}
});
const l27=replay['L27-T02-a'];
const t03='Deu erro aqui. Pode tentar de novo e me dar uma sugestão concreta de abertura, incluindo como assumir que eu deveria ter falado antes?';
const request27='Você pode sugerir uma abertura concreta, reconhecendo a entrega dela e assumindo que eu demorei a trazer isso?';
const messages27=content=>[...l27.messages.slice(0,2),{role:'user',content}];
function revised28(record='L28-T04-a'){
 const archived=replay[record],users=archived.messages.filter(m=>m.role==='user');
 const draft=users[1].content.match(/Pensei em dizer\s*[‘'][^’']+[’']/)[0];
 return {...structuredClone(archived.attempts[0]),
  stage:'explore',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],
  text:'O reconhecimento que você propõe pode ficar separado da conclusão sobre priorização. Uma opção para adaptar à sua abordagem:',
  closingSummary:'',nextStep:'',operationalClaims:[],
  delivery:{kind:'message',text:'Queria conversar sobre a avaliação. Reconheço que não deixei claro o impacto das mudanças de prioridade nos prazos. O que você esperava que eu tivesse feito quando as prioridades mudaram?'},
  authorship:{supportMode:'optional_example',requestIntent:'brief_adaptable_example',
   approachEvidence:[{message:1,quote:draft}],
   requestEvidence:[{message:1,quote:'Você pode me sugerir uma abertura'}],
   basisEvidence:[{message:0,quote:'reconheço que não deixei claro o impacto dessas mudanças nos prazos'}],
   examplePurpose:'Apoiar a revisão do esboço próprio com convite à gerente, sem substituir autoria nem acrescentar responsabilidade.'}};
}
test('L28 focal: quatro candidatos arquivados continuam recusados pelos controles originais',()=>{
 for(const id of ['L28-T02-a','L28-T04-a']){
  const a=replay[id],snapshot=JSON.stringify(a);
  a.attempts.forEach((v,i)=>assert.throws(()=>validateProgress(v,profile,a.messages,{number:3}),e=>e.message===a.validations[i][0].code&&e.validationReason===a.validations[i][0].reason));
  assert.equal(JSON.stringify(a),snapshot);
 }
});
test('L28 focal: reparo explica modo, apresentação ou evidência e aceita somente revisão fundamentada',async()=>{
 for(const id of ['L28-T02-a','L28-T04-a'])for(const original of replay[id].attempts){
  const h=provider([original,revised28(id)]),messages=replay[id].messages;
  if(id==='L28-T02-a'&&original===replay[id].attempts[0]){
   // Restricted example repair cannot fix the original imperative presentation.
   await assert.rejects(h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:3,max:10}}),e=>e.validationReason==='IMPERATIVE_PRESENTATION');
   assert.equal(h.calls.length,2);assert.equal(h.calls[1].tool_choice.name,'revisar_exemplo');
   const data=JSON.parse(h.calls[1].messages.at(-1).content.split('\n').slice(1).join('\n'));
   assert.equal(data.measurement.found,54);assert.equal(data.measurement.maximum,40);
   assert.deepEqual(h.observations[1].input.authorship,original.authorship);
   continue;
  }
  const r=await h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:3,max:10}});
  assert.equal(h.calls.length,2);assert.equal(h.events.at(-1).code,'ACCEPTED');
  const data=JSON.parse(h.calls[1].messages.at(-1).content.split('\n').slice(1).join('\n'));
  assert.deepEqual(data.rejectedCandidate,original);
  if(data.reason==='EXAMPLE_MODE_MISMATCH'){
   assert.equal(data.correction.foundSupportMode,'review');
   assert.equal(data.correction.requiredSupportMode,'optional_example');
   assert(data.correction.instruction.includes('abordagem própria literal'));
  }
  if(data.reason==='EXAMPLE_TOO_LONG'){
   assert.equal(data.measurement.found,54);assert.equal(data.measurement.maximum,40);
   assert(data.correction.instruction.includes('não a lacuna ou o pedido'));
  }
  if(data.reason==='IMPERATIVE_PRESENTATION')assert(data.correction.instruction.includes('somente delivery'));
  assert.equal(r.progress.authorship.supportMode,'optional_example');
  assert(r.progress.authorship.approachEvidence[0].quote.includes('Pensei em dizer'));
  assert.equal(r.text.split(r.progress.delivery.text).length-1,1);
  assert(!r.text.includes('isso prejudicou')&&!r.text.includes('isso criou'));
 }
});
test('L28 focal: falha repetida não é relabelada, truncada nem produz terceira geração',async()=>{
 const a=replay['L28-T04-a'],h=provider(structuredClone(a.attempts));
 await assert.rejects(()=>h.p.respond({agent:'FBK',system:profile.prompt,messages:a.messages,history:[],turn:{number:3,max:10}}),e=>e.validationReason==='EXAMPLE_MODE_MISMATCH');
 assert.equal(h.calls.length,2);assert.deepEqual(h.events.map(e=>e.reason),['EXAMPLE_MODE_MISMATCH','EXAMPLE_MODE_MISMATCH']);
 assert.equal(a.attempts[0].authorship.supportMode,'review');
});
test('L28 focal: corrigir modo não aprova causalidade inventada e comentário sem exemplo continua revisão',()=>{
 const a=replay['L28-T04-a'],bad=revised28();
 bad.delivery=structuredClone(a.attempts[0].delivery);
 assert.throws(()=>validateProgress(bad,profile,a.messages,{number:3}),/UNSUPPORTED_FACT/);
 const review=revised28();review.delivery=null;review.authorship.supportMode='review';
 assert.equal(validateProgress(review,profile,a.messages,{number:3}).progress.authorship.supportMode,'review');
 const wrong=revised28();wrong.authorship.supportMode='review';
 assert.throws(()=>validateProgress(wrong,profile,a.messages,{number:3}),e=>e.validationReason==='EXAMPLE_MODE_MISMATCH');
});
test('L28 focal: retirada, reflexão sem exemplo e pedido de terceiros não são autorização',()=>{
 const a=replay['L28-T04-a'];
 for(const last of ['Não quero mais um exemplo. Quero refletir sobre minha abordagem.','Dispenso uma frase; quero só pensar na conversa.']){
  const messages=[...a.messages,{role:'user',content:last}],v=revised28();
  assert.throws(()=>validateProgress(v,profile,messages,{number:3}),e=>e.validationReason==='EXAMPLE_WITHDRAWN');
  v.delivery=null;v.authorship.supportMode='review';
  assert.doesNotThrow(()=>validateProgress(v,profile,messages,{number:3}));
 }
 const messages=[a.messages[0],{role:'user',content:'Minha colega perguntou: “Pode me sugerir uma abertura?”'}],v=revised28();
 v.authorship.approachEvidence=[];v.authorship.requestEvidence=[{message:1,quote:'Pode me sugerir uma abertura?'}];
 assert.throws(()=>validateProgress(v,profile,messages,{number:3}),e=>e.validationReason==='EXPLICIT_REQUEST_MISSING');
});
test('L28 focal: ajuste de abertura admite perguntas por destinatário sem fechar atendimento',async()=>{
 const a=replay['L28-T04-a'],v=revised28();v.text+=' O que você quer manter da sua abordagem?';
 const h=provider([v]),r=await h.p.respond({agent:'FBK',system:profile.prompt,messages:a.messages,history:[],turn:{number:3,max:10}});
 assert.equal(h.calls.length,1);assert.equal(r.progress.stage,'explore');
 assert.equal((r.text.match(/\?/g)||[]).length,2);
 for(const audience of ['leader','manager']){
  const bad=revised28();if(audience==='leader')bad.text+=' O que manter? O que mudar?';else bad.delivery.text+=' O que faltou?';
  const deny=provider([bad,bad]);
  const recovered=await deny.p.respond({agent:'FBK',system:profile.prompt,messages:a.messages,history:[],turn:{number:3,max:10}});
  assert.equal(deny.calls.length,2);
  assert.equal(recovered.progress.evidenceStatus,'Recovery; no diagnosis asserted');
  assert.equal(recovered.progress.delivery,undefined);
  assert(!recovered.text.includes('O que mudar?')&&!recovered.text.includes('O que faltou?'));
  assert.deepEqual(deny.events.filter(e=>e.phase==='presentation').map(e=>e.code),['RESPONSE_CONSTRAINT_FAILED','RESPONSE_CONSTRAINT_FAILED']);
 }
});
test('L28 focal: encerramento real e décima troca preservam síntese e proibição de perguntas',()=>{
 const a=replay['L28-T04-a'],v=revised28();v.stage='close';
 v.closingSummary='Você reconhece que faltou clareza sobre o impacto das mudanças e quer entender as expectativas da gerente.';
 v.nextStep='Uma possibilidade é revisar a abertura com os fatos já relatados.';
 assert.throws(()=>validateProgress(v,profile,a.messages,{number:3}),/INVALID_CLOSURE/);
 v.delivery=null;v.authorship.supportMode='review';
 assert.equal(validateProgress(v,profile,[...a.messages,{role:'user',content:'Era o que eu precisava. Vou encerrar por aqui.'}],{number:3}).progress.stage,'close');
 assert.equal(validateProgress(v,profile,a.messages,{number:10}).progress.stage,'close');
 assert.throws(()=>validateProgress(revised28(),profile,a.messages,{number:10}),/INVALID_CLOSURE/);
});
test('L28 focal: efeitos exigem relato próprio, hipótese e recusa de causalidade permanecem possíveis',()=>{
 const a=replay['L28-T04-a'],statement='Isso prejudicou a leitura da avaliação.';
 assert.throws(()=>validateMethodologicalFidelity({},a.messages,[statement]),/UNSUPPORTED_FACT/);
 const forged={operationalClaims:[{kind:'impact',role:'user',message:0,quote:'reconheço que não deixei claro o impacto dessas mudanças nos prazos',text:statement}]};
 assert.throws(()=>validateMethodologicalFidelity(forged,a.messages,[statement]),/UNSUPPORTED_FACT/);
 const messages=[...a.messages,{role:'user',content:statement}],supported={operationalClaims:[{kind:'impact',role:'user',message:4,quote:statement,text:statement}]};
 assert.doesNotThrow(()=>validateMethodologicalFidelity(supported,messages,[statement]));
 for(const text of ['Como hipótese, isso prejudicou a leitura da avaliação.','Não posso afirmar que isso prejudicou a leitura da avaliação.','Não vou dizer que isso criou uma conclusão sobre priorização.'])
  assert.doesNotThrow(()=>validateMethodologicalFidelity({},a.messages,[text]));
});
function opening27(messages,request){
 return {...structuredClone(l27.attempts[1]),
  text:'Uma opção breve para você adaptar ao reconhecimento e ao atraso que relatou.',
  stage:'explore',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],
  closingSummary:'',nextStep:'',operationalClaims:[],
  delivery:{kind:'message',text:'Camila, reconheço sua entrega nos dois últimos projetos. Demorei a trazer os episódios das reuniões e gostaria de conversar sobre o que observei.'},
  authorship:{supportMode:'optional_example',approachEvidence:[],examplePurpose:'Apoio breve e adaptável à abertura solicitada, sem substituir a decisão do líder.',
   requestEvidence:[{message:1,quote:request}],basisEvidence:[
    {message:0,quote:'Ela entrega muito bem tecnicamente e cumpriu os dois últimos projetos'},
    {message:0,quote:'Nunca conversei com ela sobre isso e já adiei a avaliação duas vezes'}]}};
}
test('Condução integrada: formulações novas mantêm apoio opcional, fatos e autoria sem frase-senha',()=>{
 const requests=['Me ajuda a formular uma abertura?','Queria uma frase inicial para adaptar.','Preciso de uma frase inicial para ajustar ao meu jeito.','Por favor, me auxilie a elaborar uma abertura curta.','Consegue rascunhar uma sugestão de início?','Seria possível me dar um ponto de partida em palavras, para eu ajustar ao meu jeito?','Você pode me apoiar com algumas palavras de início, para eu reescrever depois?','Tem como me dar um ponto de partida que eu reescreva depois?'];
 for(const request of requests){
  const messages=messages27(request),v=opening27(messages,request);
  v.authorship.requestIntent='brief_adaptable_example';
  const r=validateProgress(v,profile,messages,{number:2});
  assert.equal(r.progress.authorship.requestEvidence[0].quote,request);
  assert.equal(r.progress.authorship.requestIntent,'brief_adaptable_example');
  assert.equal(r.text.split(v.delivery.text).length-1,1);
  assert(v.delivery.text.trim().split(/\s+/).length<=40);
 }
 // The two demonstrated failures also work with older payloads lacking annotation.
 for(const request of requests.slice(0,2))assert.doesNotThrow(()=>validateProgress(opening27(messages27(request),request),profile,messages27(request),{number:2}));
});
test('Condução integrada: interpretação não ultrapassa negativa, retirada, terceiro, fonte e base factual',()=>{
 for(const request of ['Não me ajude a formular uma abertura.','Não quero que você elabore uma frase inicial.','Não queria uma frase inicial.','Sem frases iniciais.','Retiro meu pedido de exemplo.','Camila perguntou: “Me ajuda a formular uma abertura?”','Camila gostaria de um exemplo.','O colega queria uma frase inicial para adaptar.','Meu chefe gostaria de um exemplo.','Gostaria de um discurso completo para toda a conversa.','Esse é o problema que quero entender.']){
  const v=opening27(messages27(request),request);v.authorship.requestIntent='brief_adaptable_example';
  assert.throws(()=>validateProgress(v,profile,messages27(request),{number:2}),e=>e.message==='AUTONOMY_CONSTRAINT_FAILED',request);
 }
 const request='Me ajuda a formular uma abertura?',messages=messages27(request),v=opening27(messages,request);
 v.authorship.requestIntent='brief_adaptable_example';v.authorship.basisEvidence=[];
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),e=>e.validationReason==='FACTUAL_BASIS_MISSING');
 v.authorship.basisEvidence=[{message:0,quote:'Fato que ninguém relatou.'}];
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),/INVALID_PROGRESS_EVIDENCE/);
});
test('Condução integrada: reparo recebe candidato, medida real e limite, preserva exemplo permitido e revalida',async()=>{
 const request='Me ajuda a formular uma abertura?',messages=messages27(request),first=opening27(messages,request),fixed=opening27(messages,request);
 first.authorship.requestIntent='brief_adaptable_example';fixed.authorship.requestIntent='brief_adaptable_example';
 first.delivery.text=Array(45).fill('palavra').join(' ');
 const h=provider([first,fixed]);
 const result=await h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:2,max:10}});
 assert.equal(h.calls.length,2);assert.equal(result.progress.delivery.text,fixed.delivery.text);
 const data=JSON.parse(h.calls[1].messages.at(-1).content.split('\n').at(-1));
 assert.equal(data.code,'AUTONOMY_CONSTRAINT_FAILED');assert.equal(data.reason,'EXAMPLE_TOO_LONG');
 assert.deepEqual(data.rejectedCandidate,first);
 assert.deepEqual(data.measurement,{field:'delivery.text',found:45,maximum:40,target:30});
 assert.equal(h.calls[0].max_tokens,2200);assert.equal(h.calls[1].max_tokens,600);
 assert.equal(h.calls[1].tool_choice.name,'revisar_exemplo');
 assert.equal(messages.filter(m=>m.role==='assistant'&&m.content===first.text).length,0);
 assert.equal(result.text.split(fixed.delivery.text).length-1,1);
});
test('Condução integrada: reparo preserva correção do líder sem aceitar impacto inventado',async()=>{
 const request='Queria uma frase inicial para adaptar.',messages=[...messages27(request),{role:'user',content:'Só confirmei retrabalho. Não confirmei impacto no planejamento nem na confiança.'}];
 const first=opening27(messages,request),fixed=opening27(messages,request);
 first.text='Isso prejudicou o planejamento do cliente.';
 first.operationalClaims=[];
 const h=provider([first,fixed]);
 const r=await h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:3,max:10}});
 assert.equal(h.calls.length,2);assert(!r.text.includes('prejudicou'));
 const data=JSON.parse(h.calls[1].messages.at(-1).content.split('\n').at(-1));
 assert.equal(data.code,'UNSUPPORTED_FACT');assert.equal(data.measurement,undefined);
 assert(h.calls[1].messages.some(m=>m.content===messages.at(-1).content));
 assert.deepEqual(data.rejectedCandidate,first);
});
test('Condução integrada: candidato interno não vira fonte do líder; segunda recusa não causa terceira chamada',async()=>{
 const request='Queria uma frase inicial para adaptar.',messages=messages27(request),first=opening27(messages,request),bad=opening27(messages,request);
 first.delivery.text=Array(44).fill('palavra').join(' ');
 bad.authorship.requestEvidence=[{message:messages.filter(m=>m.role==='user').length,quote:first.text}];
 assert.throws(()=>validateProgress(bad,profile,messages,{number:2}),/INVALID_PROGRESS_EVIDENCE/);
 const h=provider([first,{text:bad.delivery.text,authorship:bad.authorship}]);
 await assert.rejects(()=>h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:2,max:10}}),/INVALID_PROGRESSION/);
 assert.equal(h.calls.length,2);
 assert(h.calls[1].messages.at(-1).content.includes('NÃO CONFIÁVEL'));
 const again=provider([first,first]);
 await assert.rejects(()=>again.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:2,max:10}}),e=>e.validationReason==='EXAMPLE_TOO_LONG');
 assert.equal(again.calls.length,2);
});
test('Condução integrada: sete especializações preservam autoridade, referências e Evolução desativada',async()=>{
 const agents=contract.agents.filter(a=>a.mode==='conversacional');assert.equal(agents.length,7);
 const rows=[];
 for(const a of agents){
  let call;const h=mod.exports.createModelProviders({client:{messages:{create:async payload=>{call=payload;throw Error('CAPTURE_ONLY');}}}});
  await assert.rejects(()=>h.respond({agent:a.id,system:a.prompt,messages:[{role:'user',content:'Conteúdo fictício para medir composição.'}],history:[],turn:{number:1,max:10}}),/CAPTURE_ONLY/);
  assert(call.system.startsWith(a.prompt));assert.equal(call.system.split('CONDUÇÃO COMUM (').length-1,1);
  assert.equal(call.system.includes('APOIO À COMUNICAÇÃO:'),['FBK','OTO'].includes(a.id));
  rows.push({agent:a.id,systemChars:call.system.length,canonicalChars:a.prompt.length,systemSHA256:require('node:crypto').createHash('sha256').update(call.system).digest('hex'),messages:call.messages.length});
 }
 // Measurement only goes to /tmp during tests; historical/campaign state is never opened.
 fs.writeFileSync(path.join(os.tmpdir(),'iai-conversation-composition-after.json'),JSON.stringify(rows,null,2)+'\n');
 for(const a of contract.agents.filter(a=>a.mode!=='conversacional')){
  const h=provider([]);await assert.rejects(()=>h.p.respond({agent:a.id,system:a.prompt,messages:[],history:[],turn:{number:1,max:10}}),/INVALID_PROGRESSION/);assert.equal(h.calls.length,0);
 }
});
test('Pedido explícito: gerações T02 arquivadas avançam do falso negativo para recusa real por tamanho, sem aprová-las',()=>{
 for(const raw of l27.attempts){
  const before=JSON.stringify(raw);
  assert.throws(()=>validateProgress(raw,profile,l27.messages,{number:2}),
   e=>e.message==='AUTONOMY_CONSTRAINT_FAILED'&&e.validationReason==='EXAMPLE_TOO_LONG');
  assert.equal(JSON.stringify(raw),before);
 }
});
test('Pedido explícito: literal T02, variante T03 e equivalentes aceitam somente abertura opcional curta com fatos',()=>{
 for(const request of [request27,t03,'Poderia propor uma abertura breve?','Você consegue elaborar uma abertura curta?','Quero uma abertura breve.','Me sugira uma abertura curta.']){
  const messages=messages27(request),v=opening27(messages,request);
  const r=validateProgress(v,profile,messages,{number:2});
  assert.equal(r.progress.authorship.supportMode,'optional_example');
  assert.equal(r.progress.authorship.approachEvidence.length,0);
  assert.equal(r.progress.authorship.requestEvidence[0].quote,request);
  assert.equal(r.text.split(v.delivery.text).length-1,1);
  assert(v.delivery.text.split(/\s+/).length<=40);
 }
});
test('Pedido explícito: negações, retirada e negação omitida da citação não autorizam exemplo',()=>{
 for(const negative of ['Não pode sugerir uma abertura concreta.','Você pode não sugerir uma abertura?','Não quero que você sugira uma abertura.','Dispenso uma abertura.','Sem exemplos.']){
  const messages=messages27(negative),v=opening27(messages,negative);
  assert.throws(()=>validateProgress(v,profile,messages,{number:2}),e=>e.validationReason==='EXAMPLE_WITHDRAWN');
 }
 const messages=[l27.messages[0],{role:'user',content:'Não pode sugerir uma abertura concreta.'},{role:'user',content:'Quero refletir sobre os episódios.'}];
 const v=opening27(messages,'pode sugerir uma abertura concreta');
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),e=>e.validationReason==='EXPLICIT_REQUEST_MISSING');
});
test('Pedido explícito: fala de terceiros, assistente, citação inventada e ambiguidade continuam recusadas',()=>{
 for(const content of ['Minha colega perguntou: “'+request27+'”','Ela pediu que eu pergunte: “'+request27+'”','A pergunta da colega foi: “'+request27+'”','Ela pode sugerir uma abertura concreta.']){
  const q=content.startsWith('Ela pode')?'pode sugerir uma abertura concreta':request27;
  const messages=messages27(content),v=opening27(messages,q);
  assert.throws(()=>validateProgress(v,profile,messages,{number:2}),e=>e.validationReason==='EXPLICIT_REQUEST_MISSING');
 }
 const other=[{role:'user',content:'Quero refletir.'},{role:'assistant',content:request27},{role:'user',content:'Ainda estou pensando.'}];
 assert.throws(()=>validateProgress(opening27(other,request27),profile,other,{number:2}),/INVALID_PROGRESS_EVIDENCE/);
 const messages=messages27(request27),v=opening27(messages,'Pode inventar uma abertura que não pedi?');
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),/INVALID_PROGRESS_EVIDENCE/);
 const repeated=[l27.messages[0],{role:'user',content:request27},{role:'user',content:request27}],ambiguous=opening27(repeated,request27);
 ambiguous.authorship.requestEvidence[0].message=9;
 assert.throws(()=>validateProgress(ambiguous,profile,repeated,{number:2}),/INVALID_PROGRESS_EVIDENCE/);
});
test('Pedido explícito: ausência de fatos, discurso longo e apresentação imperativa continuam recusados',()=>{
 const messages=messages27(request27);
 let v=opening27(messages,request27);v.authorship.basisEvidence=[];
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),e=>e.validationReason==='FACTUAL_BASIS_MISSING');
 v=opening27(messages,request27);v.delivery.text='palavra '.repeat(41);
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),e=>e.validationReason==='EXAMPLE_TOO_LONG');
 v=opening27(messages,request27);v.text='Diga essa frase e cobre uma decisão.';
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),e=>e.validationReason==='IMPERATIVE_PRESENTATION');
});
test('Pedido explícito: adaptador real aceita variante T03 após reparo de tamanho com SDK simulado',async()=>{
 const messages=messages27(t03),tooLong=opening27(messages,t03);tooLong.delivery.text='palavra '.repeat(41);
 const h=provider([tooLong,opening27(messages,t03)]);
 const r=await h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:2,max:10}});
 assert.equal(h.calls.length,2);assert.equal(h.events[0].reason,'EXAMPLE_TOO_LONG');
 assert.equal(h.events[1].code,'ACCEPTED');assert.equal(r.progress.authorship.requestEvidence[0].quote,t03);
 assert.equal(r.text.split(r.progress.delivery.text).length-1,1);
});
test('Pedido explícito: tom recusa certeza corretiva sobre intenção, preserva fatos e hipótese identificada',()=>{
 const bad='A dificuldade não é parecer que guardou — é que você guardou.';
 assert.throws(()=>validateMethodologicalFidelity({operationalClaims:[]},l27.messages,[bad]),/UNSUPPORTED_FACT/);
 const fact='Você relatou que adiou a avaliação duas vezes e ainda não conversou sobre os episódios.';
 assert.equal(validateMethodologicalFidelity({operationalClaims:[]},l27.messages,[fact]),'methodological-2');
 assert.equal(validateMethodologicalFidelity({operationalClaims:[]},l27.messages,['Como hipótese, '+bad.toLowerCase()]),'methodological-2');
});
test('Reparo EXAMPLE_TOO_LONG: pedido recebe contagem real arquivada de 53 ou 42, máximo 40 e meta 30',async()=>{
 const archived=replay['L27-T03-a'],messages=archived.messages;
 for(const [index,words] of [53,42].entries()){
  const original=archived.attempts[index],snapshot=JSON.stringify(original);
  assert.equal(original.delivery.text.trim().split(/\s+/).length,words);
  // Keep archived example/count, supply valid presentation for this scope control.
  const h=provider([{...structuredClone(original),text:opening27(messages,t03).text},opening27(messages,t03)]);
  const r=await h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:2,max:10}});
  assert.equal(h.calls.length,2);
  assert(!h.calls[0].system.includes('DIAGNÓSTICO EXAMPLE_TOO_LONG:'));
  assert(h.calls[1].system.includes(`DIAGNÓSTICO EXAMPLE_TOO_LONG: delivery.text contém ${words} palavras; máximo permitido: 40; meta de reparo: até 30 palavras, com margem.`));
  assert(h.calls[1].system.includes('preservando sentido, fatos, caráter opcional e adaptável e autoria do líder'));
  assert.equal(h.events[0].reason,'EXAMPLE_TOO_LONG');
  assert.equal(h.events[1].code,'ACCEPTED');
  assert.equal(r.progress.delivery.text,opening27(messages,t03).delivery.text);
  assert.equal(JSON.stringify(original),snapshot);
 }
});
test('Reparo EXAMPLE_TOO_LONG: diagnóstico numérico ausente em falhas não relacionadas',async()=>{
 const messages=messages27(t03);
 for(const [reason,change] of [
  ['EXPLICIT_REQUEST_MISSING',v=>{v.authorship.requestEvidence=[];}],
  ['FACTUAL_BASIS_MISSING',v=>{v.authorship.basisEvidence=[];}],
  ['IMPERATIVE_PRESENTATION',v=>{v.text='Diga essa frase.';}],
  [undefined,v=>{v.authorship.requestEvidence[0].quote='Fonte inexistente para esse pedido.';}],
 ]){
  const bad=opening27(messages,t03);change(bad);
  if(reason==='EXPLICIT_REQUEST_MISSING')bad.delivery.text='palavra '.repeat(53);
  const h=provider([bad,opening27(messages,t03)]);
  await h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:2,max:10}});
  assert.equal(h.calls.length,2);
  assert.equal(h.events[0].reason,reason);
  assert(h.calls.every(c=>!c.system.includes('DIAGNÓSTICO EXAMPLE_TOO_LONG:')));
 }
});
test('Reparo EXAMPLE_TOO_LONG: reparo ainda longo é recusado sem terceira chamada nem truncamento',async()=>{
 const archived=replay['L27-T03-a'],h=provider(structuredClone(archived.attempts));
 await assert.rejects(h.p.respond({agent:'FBK',system:profile.prompt,messages:archived.messages,history:[],turn:{number:2,max:10}}),
  e=>e.message==='AUTONOMY_CONSTRAINT_FAILED'&&e.validationReason==='EXAMPLE_TOO_LONG');
 assert.equal(h.calls.length,2);
 assert.deepEqual(h.events.map(e=>e.reason),['EXAMPLE_TOO_LONG','EXAMPLE_TOO_LONG']);
 assert(h.calls[1].system.includes('delivery.text contém 53 palavras; máximo permitido: 40'));
});
test('Reparo EXAMPLE_TOO_LONG: ser curto não contorna fonte, pedido, fatos, modo, imperativos ou efeitos',async()=>{
 const archived=replay['L27-T03-a'],messages=archived.messages;
 for(const [code,reason,change] of [
  ['INVALID_PROGRESS_EVIDENCE',undefined,v=>{v.authorship.requestEvidence[0].quote='Pedido inventado sem origem.';}],
  ['AUTONOMY_CONSTRAINT_FAILED','EXPLICIT_REQUEST_MISSING',v=>{v.authorship.requestEvidence=[];}],
  ['AUTONOMY_CONSTRAINT_FAILED','FACTUAL_BASIS_MISSING',v=>{v.authorship.basisEvidence=[];}],
  ['AUTONOMY_CONSTRAINT_FAILED','EXAMPLE_MODE_MISMATCH',v=>{v.authorship.supportMode='explore';}],
  ['AUTONOMY_CONSTRAINT_FAILED','IMPERATIVE_PRESENTATION',v=>{v.text='Diga essa frase.';}],
  ['UNSUPPORTED_FACT',undefined,v=>{v.text='Clareza garante a relação.';}],
 ]){
  const short=opening27(messages,t03);change(short);
  const {applyExampleRepair}=require('../artifacts/api-server/src/lib/conversation-instructions.cjs');
  const merged=applyExampleRepair(short,{text:short.delivery.text}).candidate;
  assert.throws(()=>validateProgress(merged,profile,messages,{number:2,max:10}),e=>e.message===code&&e.validationReason===reason);
 }
});

const l29=replay['L29-T02-a'],resume29=replay['L29-T03-a'];
const short29='Em duas ocasiões, os dados atrasaram e refiz a consolidação. Também mudei o formato em uma delas. Quero combinar prazos e avisos antecipados.';
// Synthetic positive control only: the raw archive has an invalid assistant claim.
// Runtime repair never removes or rewrites that claim; full validation refuses it.
const scopeSeed29=()=>({...structuredClone(l29.attempts[0]),operationalClaims:[]});
test('L29 focal: candidatos brutos preservam recusa 65/45 e reparo repetido não ganha terceira chamada',async()=>{
 assert.deepEqual(l29.attempts.map(v=>v.delivery.text.trim().split(/\s+/).length),[65,45]);
 for(const v of l29.attempts)assert.throws(()=>validateProgress(v,profile,l29.messages,{number:2}),e=>e.validationReason==='EXAMPLE_TOO_LONG');
 const h=provider([l29.attempts[0],{text:l29.attempts[1].delivery.text}]);
 await assert.rejects(h.p.respond({agent:'FBK',system:profile.prompt,messages:l29.messages,history:[],turn:{number:2,max:10}}),e=>e.validationReason==='EXAMPLE_TOO_LONG');
 assert.equal(h.calls.length,2);assert.deepEqual(h.events.map(e=>e.reason),['EXAMPLE_TOO_LONG','EXAMPLE_TOO_LONG']);
});
test('L29 focal: reparo altera só exemplo, remove cópia antiga e preserva autoria, estágio e fontes',async()=>{
 const original=scopeSeed29(),snapshot=JSON.stringify(original),h=provider([original,{text:short29}]);
 const r=await h.p.respond({agent:'FBK',system:profile.prompt,messages:l29.messages,history:[],turn:{number:2,max:10}});
 assert.equal(h.calls.length,2);assert.equal(h.calls[1].tool_choice.name,'revisar_exemplo');assert.equal(h.calls[1].max_tokens,600);
 assert.deepEqual(h.calls[1].tools[0].input_schema.required,['text']);assert.equal(h.calls[1].tools[0].input_schema.additionalProperties,false);
 const data=JSON.parse(h.calls[1].messages.at(-1).content.split('\n').slice(1).join('\n'));
 assert.deepEqual(data.measurement,{field:'delivery.text',found:65,maximum:40,target:30});assert.deepEqual(data.rejectedCandidate,original);
 const merged=h.observations[1].input;
 for(const k of Object.keys(original).filter(k=>!['text','delivery'].includes(k)))assert.deepEqual(merged[k],original[k],k);
 assert.equal(merged.delivery.kind,original.delivery.kind);assert.equal(merged.delivery.text,short29);
 assert.equal(h.observations[1].repairScope,'delivery.text');assert.deepEqual(h.observations[1].rawRepairInput,{text:short29});
 assert(h.observations[1].repairNormalizations.some(n=>n.field==='text'));
 assert(r.text.startsWith(original.text.split('\n\n"')[0]));
 assert(!r.text.includes(original.delivery.text));assert.equal(r.text.split(short29).length-1,1);
 assert.equal(JSON.stringify(original),snapshot);assert.equal(r.progress.authorship.supportMode,'optional_example');
});
test('L29 focal: tempo inventado é recusado; relato afirmativo e hipótese identificada são distintos',()=>{
 const {applyExampleRepair}=require('../artifacts/api-server/src/lib/conversation-instructions.cjs');
 for(const text of ['Em duas entregas recentes, refiz a consolidação.','Nos últimos meses, refiz a consolidação.']){
  const v=applyExampleRepair(scopeSeed29(),{text}).candidate;
  assert.throws(()=>validateProgress(v,profile,l29.messages,{number:2}),/UNSUPPORTED_FACT/);
  const source={role:'user',content:text};
  assert.doesNotThrow(()=>validateProgress(v,profile,[...l29.messages,source],{number:2}));
  assert.throws(()=>validateProgress(v,profile,[...l29.messages,{role:'user',content:'Não confirmei: '+text.replace('.','?')}],{number:2}),/UNSUPPORTED_FACT/);
 }
 const v=applyExampleRepair(scopeSeed29(),{text:short29}).candidate;
 v.text='Não sabemos se foram recentes. A base disponível são os dois episódios.';
 assert.doesNotThrow(()=>validateProgress(v,profile,l29.messages,{number:2}));
});
test('L29 focal: reparo não salva fatos inválidos fora do exemplo nem permite mudar contrato',async()=>{
 const raw=provider([l29.attempts[0],{text:short29}]);
 // Unused raw metadata no longer vetoes a valid displayed response; the
 // visible false fact and attempted contract mutation below still fail.
 await raw.p.respond({agent:'FBK',system:profile.prompt,messages:l29.messages,history:[],turn:{number:2,max:10}});
 assert.deepEqual(raw.observations[1].input.operationalClaims,l29.attempts[0].operationalClaims);
 assert.equal(raw.calls.length,2);
 const bad=scopeSeed29();bad.text+=' Foram entregas recentes.';
 const h=provider([bad,{text:short29}]);
 await assert.rejects(h.p.respond({agent:'FBK',system:profile.prompt,messages:l29.messages,history:[],turn:{number:2,max:10}}),/UNSUPPORTED_FACT/);
 assert.equal(h.calls.length,2);
 const injected=provider([l29.attempts[0],{text:short29,authorship:{supportMode:'review'}}]);
 await assert.rejects(injected.p.respond({agent:'FBK',system:profile.prompt,messages:l29.messages,history:[],turn:{number:2,max:10}}),/INVALID_PROGRESSION/);
 assert.equal(injected.calls.length,2);
});

const ab29=replay['EX05-C3-COMPARE-L29-T02-preflight'].execution;
const ab29Audit=ab29.conditions.B.checkpoint.audit.at(-1);
const validAb29=()=>({...structuredClone(ab29Audit.generationAttempts[0].input),
 text:'Uma opção curta, para você adaptar ou discordar:',
 delivery:{kind:'message',text:'Em duas entregas, os dados chegaram após o prazo e refiz a consolidação. Em uma, mudei o formato perto do prazo. Gostaria de combinar prazos e aviso antecipado quando houver impedimentos.'}});
test('Condução focal 4: replay real preserva 61 palavras e recusa temporal do reparo de 38',()=>{
 const [first,second]=ab29Audit.generationAttempts;
 assert.throws(()=>validateProgress(first.input,profile,ab29.messages,{number:2}),e=>e.validationReason==='EXAMPLE_TOO_LONG');
 assert.equal(second.input.delivery.text.split(/\s+/).length,38);
 assert.throws(()=>validateProgress(second.input,profile,ab29.messages,{number:2}),e=>e.message==='UNSUPPORTED_FACT'&&e.validationReason==='UNSUPPORTED_TEMPORAL_FACT');
 assert.deepEqual(second.input.operationalClaims,[]);
});
test('Condução focal 4: reparo recebe o termo temporal real e só entrega uma versão sustentada',async()=>{
 const first=structuredClone(ab29Audit.generationAttempts[0].input),good=validAb29();
 // Positive fixture has valid presentation; original archive stays unchanged
 // and its unsupported categorical reading is covered separately below.
 first.text=good.text+'\n\n'+first.delivery.text;
 const h=provider([first,{text:good.delivery.text}]);
 const result=await h.p.respond({agent:'FBK',system:profile.prompt,messages:ab29.messages,history:[],turn:{number:2,max:10}});
 assert.equal(h.calls.length,2);
 const internal=JSON.parse(h.calls[1].messages.at(-1).content.split('\n').slice(1).join('\n'));
 assert.equal(internal.measurement.found,61);assert.equal(internal.measurement.maximum,40);
 assert(internal.factualDiagnostics.some(x=>x.text==='recentes'));
 assert.equal(result.text.split(good.delivery.text).length-1,1);
 assert(!result.text.includes(first.delivery.text));
});
test('Condução focal 4: encurtar exemplo não legitima interpretação categórica sem fonte',async()=>{
 const h=provider([ab29Audit.generationAttempts[0].input,{text:validAb29().delivery.text}]);
 await assert.rejects(()=>h.p.respond({agent:'FBK',system:profile.prompt,messages:ab29.messages,history:[],turn:{number:2,max:10}}),/UNSUPPORTED_FACT/);
 assert.equal(h.calls.length,2);
 assert(h.observations[1].input.text.includes('A dificuldade real está'));
});
test('Condução focal 4: ajuda curta fundamentada sem triagem adicional passa pelo fluxo validado',async()=>{
 const good=validAb29(),h=provider([good]);
 const result=await h.p.respond({agent:'FBK',system:profile.prompt,messages:ab29.messages,history:[],turn:{number:2,max:10}});
 assert.equal(h.calls.length,1);assert.equal(result.text.split(good.delivery.text).length-1,1);
 assert(result.text.includes(good.text));assert(!result.text.includes('?'));
 assert.equal(result.progress.authorship.supportMode,'optional_example');
});
test('Condução focal 4: registro interno irrelevante é omitido sem reatribuir fonte',()=>{
 const good=validAb29(),claim=structuredClone(l29.attempts[0].operationalClaims[0]);
 good.operationalClaims=[claim];
 assert.doesNotThrow(()=>validateProgress(good,profile,ab29.messages,{number:2}));
 const normalizations=[];
 const {validateGrounding}=require('../artifacts/api-server/src/lib/response-grounding.cjs');
 assert.deepEqual(validateGrounding(good,ab29.messages,[good.text,good.delivery.text],normalizations),[]);
 assert.equal(normalizations[0].type,'unused_operational_claim_omitted');
 assert.deepEqual(normalizations[0].claim,claim);
});
test('Condução focal 4: informação exposta exige fonte mesmo com registro interno descartável',()=>{
 const good=validAb29();good.operationalClaims=[structuredClone(l29.attempts[0].operationalClaims[0])];
 for(const text of ['As entregas recentes causaram impacto no cliente.','Isso prejudicou o planejamento e a confiança do cliente.']){
  const bad={...good,text};assert.throws(()=>validateProgress(bad,profile,ab29.messages,{number:2}),/UNSUPPORTED_FACT/);
 }
 const bad={...good,operationalClaims:[{kind:'prior_assistant_content',role:'assistant',message:1,quote:ab29.messages[0].content,text:good.text}]};
 assert.throws(()=>validateProgress(bad,profile,ab29.messages,{number:2}),/UNSUPPORTED_FACT/);
});
test('Condução focal 4: correção temporal atual invalida afirmação anterior, hipótese continua hipótese',()=>{
 const {validateGrounding}=require('../artifacts/api-server/src/lib/response-grounding.cjs');
 const earlier=[{role:'user',content:'Foram entregas recentes.'}];
 assert.doesNotThrow(()=>validateGrounding({},earlier,['Foram entregas recentes.']));
 const corrected=[...earlier,{role:'user',content:'Corrigindo: não disse que foram recentes.'}];
 assert.throws(()=>validateGrounding({},corrected,['Foram entregas recentes.']),e=>e.validationReason==='UNSUPPORTED_TEMPORAL_FACT');
 assert.doesNotThrow(()=>validateGrounding({},corrected,['Não sabemos se foram recentes.']));
});
test('Condução focal 4: retirada atual de exemplo vence pedido anterior preservado',()=>{
 const good=validAb29(),messages=[...ab29.messages,{role:'user',content:'Não quero exemplo. Prefiro refletir sobre a abordagem.'}];
 assert.throws(()=>validateProgress(good,profile,messages,{number:2}),e=>e.validationReason==='EXAMPLE_WITHDRAWN');
 const noExample={...good,delivery:null,authorship:{...good.authorship,supportMode:'explore',approachEvidence:[]},text:'Podemos examinar o que é responsabilidade sua e o que precisa ser combinado, sem transformar dois episódios em padrão.'};
 assert.doesNotThrow(()=>validateProgress(noExample,profile,messages,{number:2}));
});
test('Condução focal 4: composição usa um exemplo canônico limitado por função sem ativar Evolução',()=>{
 const {canonicalExample}=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
 const {responseInstructions,CONVERSATION_REVISION}=require('../artifacts/api-server/src/lib/conversation-instructions.cjs');
 assert.equal(CONVERSATION_REVISION,'EX05-2-conversation-4');
 for(const id of ['MNT','CTN','PRF','IMP','FBK','OTO','CRS']){
  const example=canonicalExample(id);assert(example.length>0&&example.length<2300);
  assert.equal(responseInstructions(id).split(example).length-1,1);
 }
 assert.equal(canonicalExample('EVL'),'');assert.throws(()=>responseInstructions('EVL'),/INVALID_PROGRESSION/);
});
test('L29 focal: contradição e referência sem base não dominam necessidade estabelecida',()=>{
 const {readFunctionalNeed}=require('../artifacts/api-server/src/lib/functional-context.cjs');
 const a=resume29.classification,messages=resume29.messages,previous=resume29.previous,snapshot=JSON.stringify(a);
 const need=readFunctionalNeed(a,messages,previous);
 assert.equal(need.job,'prepare_message');assert.equal(need.inherited,true);assert.equal(need.substantiveDecisionPending,false);assert.equal(need.pendingRejection,'decision_already_clear');
 const route=decideRoute(a,{reportedMessages:messages,functionalNeed:previous});
 assert.equal(route.agent,'FBK');assert.equal(route.reason,'message_preparation_context_preserved');assert.equal(JSON.stringify(a),snapshot);
 for(const patch of [
  {decisionSufficientlyClear:false,needEvidence:[]},
  {decisionSufficientlyClear:false,needEvidence:[a.needEvidence[0]],decisionEvidence:[{message:2,quote:'Uma escolha que não foi relatada.'}]},
  {decisionSufficientlyClear:undefined,needEvidence:[a.needEvidence[0]]}
 ]){
  const invalid={...a,...patch},v=readFunctionalNeed(invalid,messages,previous);
  assert.equal(v.substantiveDecisionPending,false);assert(v.pendingRejection);
 }
});
test('L29 focal: retomada sem expressão-senha usa fonte anterior compatível, sem copiar rota incondicionalmente',()=>{
 for(const content of ['A falha interrompeu o que pedi. Vamos retomar?','Ainda preciso daquele apoio.']){
  const messages=[...resume29.messages.slice(0,-1),{role:'user',content}];
  const a={...resume29.classification,job:'unclear',needEvidence:[],decisionEvidence:[],substantiveDecisionPending:false};
  const route=decideRoute(a,{reportedMessages:messages,functionalNeed:resume29.previous});
  assert.equal(route.agent,'FBK');assert.equal(route.reason,'message_preparation_context_preserved');
  const noPrior=decideRoute(a,{reportedMessages:messages});
  assert.equal(noPrior.mode,'clarify');
 }
});
test('L29 focal: decisão genuinamente pendente exige clareza false e referências válidas; correção atual prevalece',()=>{
 const {readFunctionalNeed}=require('../artifacts/api-server/src/lib/functional-context.cjs');
 const content='Quero preparar o registro, mas ainda não decidi se devo cobrar a entrega ou revisar o processo.';
 const messages=[...resume29.messages.slice(0,-1),{role:'user',content}];
 const evidence=[{message:2,quote:content}];
 const a={...resume29.classification,decisionSufficientlyClear:false,substantiveDecisionPending:true,needEvidence:evidence,decisionEvidence:evidence};
 const prior=readFunctionalNeed(a,messages,resume29.previous);
 assert.equal(prior.substantiveDecisionPending,true);
 assert.equal(decideRoute(a,{reportedMessages:messages,functionalNeed:resume29.previous}).reason,'substantive_decision_pending');
 const carry={...a,job:'unclear',needEvidence:[],decisionEvidence:[],decisionSufficientlyClear:undefined};
 const carried=readFunctionalNeed(carry,messages,prior);
 assert.equal(carried.substantiveDecisionPending,true);assert.deepEqual(carried.decisionEvidence,evidence);
 assert.equal(readFunctionalNeed(carry,messages,carried).substantiveDecisionPending,true);
 const current='Já defini que quero combinar prazos e avisos; falta só elaborar a comunicação.';
 const next=[...messages,{role:'user',content:current}];
 const corrected={...a,needEvidence:[{message:3,quote:current}],decisionSufficientlyClear:true,substantiveDecisionPending:false,decisionEvidence:[]};
 assert.equal(decideRoute(corrected,{reportedMessages:next,functionalNeed:prior}).agent,'FBK');
});
test('L29 focal: nova necessidade, retirada da escrita e risco concreto mantêm prioridade',()=>{
 for(const [job,agent,content] of [
  ['compare_paths','MNT','Quero decidir entre cobrar a entrega e revisar o processo.'],
  ['understand_impact','IMP','Não quero escrever agora. Quero compreender o efeito da minha mudança no colega.']
 ]){
  const messages=[...resume29.messages,{role:'user',content}],evidence=[{message:3,quote:content}];
  const a={...resume29.classification,job,confidence:'moderate',needEvidence:evidence,substantiveDecisionPending:false};
  assert.equal(decideRoute(a,{reportedMessages:messages,functionalNeed:resume29.previous}).agent,agent);
 }
 const content='Há fogo agora e duas pessoas estão presas.',messages=[...resume29.messages,{role:'user',content}];
 const risk={...resume29.classification,immediateExternalRisk:true,riskKind:'physical',riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:content,riskImpactEvidence:'duas pessoas estão presas'};
 assert.equal(decideRoute(risk,{reportedMessages:messages,functionalNeed:resume29.previous}).agent,'CRS');
});
test('L29 focal: falha seguida de retomada conserva T02, não conta erro e repetição não gera',async()=>{
 const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId},state={budget:{charged:123,calls:[]}};
 const store=createPilotStore(state),session=store.open(scope);
 state.session.exchangeCount=1;state.session.context={messages:structuredClone(l29.messages.slice(0,-1)),functionalNeed:structuredClone(resume29.previous)};
 let classifications=0,generations=0;const seen=[];
 const svc=createConversationService({repository:store.repository,agentPrompts:{FBK:profile.prompt},
  classify:async({messages})=>{seen.push(structuredClone(messages));classifications++;return classifications===1
   ?{...resume29.classification,decisionSufficientlyClear:true,substantiveDecisionPending:false,needEvidence:[resume29.classification.needEvidence[0]],decisionEvidence:[]}
   :structuredClone(resume29.classification);},
  respond:async()=>{generations++;if(generations===1)throw Error('INVALID_MODEL_RESPONSE');return {text:'Você já definiu prazos e aviso antecipado; a dificuldade é elaborar a comunicação.'};}});
 const t02={sessionId:session.id,requestId:'synthetic-T02',content:l29.messages.at(-1).content};
 await assert.rejects(svc.turn(scope,t02));assert.equal(state.session.exchangeCount,1);
 const t03={sessionId:session.id,requestId:'synthetic-T03',content:resume29.messages.at(-1).content};
 const result=await svc.turn(scope,t03);
 assert.equal(result.route.agent,'FBK');assert.equal(result.exchangeCount,2);
 assert.equal(seen[1].filter(m=>m.role==='user'&&m.content===t02.content).length,1);
 assert(seen[1].some(m=>m.content===l29.messages[0].content));assert.equal(seen[1].filter(m=>m.role==='assistant').length,1);
 assert.equal((await svc.turn(scope,t03)).replayed,true);assert.equal(classifications,2);assert.equal(generations,2);
 assert.equal(state.budget.charged,123);assert.equal(state.budget.calls.length,0);
});
