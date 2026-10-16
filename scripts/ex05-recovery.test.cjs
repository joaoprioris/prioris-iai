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
 const calls=[],events=[];
 const p=mod.exports.createModelProviders({onValidationObservation:e=>events.push(e),client:{messages:{create:async payload=>{
  calls.push(payload);assert(values.length>0,'Unexpected model invocation');
  return {stop_reason:'tool_use',content:[{type:'tool_use',name:payload.tool_choice.name,input:structuredClone(values.shift())}],usage:{input_tokens:0,output_tokens:0}};
 }}}});
 return {p,calls,events};
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
  const h=provider([original,opening27(messages,t03)]);
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
  const h=provider([archived.attempts[0],short]);
  await assert.rejects(h.p.respond({agent:'FBK',system:profile.prompt,messages,history:[],turn:{number:2,max:10}}),
   e=>e.message===code&&e.validationReason===reason);
  assert.equal(h.calls.length,2);assert.equal(h.events[0].reason,'EXAMPLE_TOO_LONG');
  assert.equal(h.events[1].code,code);assert.equal(h.events[1].reason,reason);
 }
});
