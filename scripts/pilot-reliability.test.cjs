'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {createPilotDelivery}=require('../artifacts/api-server/src/lib/pilot-delivery.cjs');
const {createPilotStore}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
const {pilotIdentity,advanceBlock}=require('../artifacts/api-server/src/lib/pilot-next-round.cjs');
const sid='00000000-0000-4000-8000-000000000999';
const identity=pilotIdentity(19),scope={userId:identity.id,organizationId:identity.organizationId};
const input={sessionId:sid,requestId:'fictional-request-1',content:'Quero comparar opções fictícias.'};
function fixture(){return {version:'0.3.4',round:19,provider:'replit',expiresAt:Date.now()+7200000,
 budget:{cap:5000000,charged:1000,calls:[],recoveryHoldMicroUSD:1000},requests:{},audit:[],
 session:{id:sid,...scope,status:'active',exchangeCount:0,context:{messages:[]}},archivedRounds:[]};}
test('Recibo persistente precede execução; replay e conteúdo conflitante não duplicam',()=>{
 const s=fixture();let writes=0;const d=createPilotDelivery(s,()=>writes++);
 assert.equal(d.begin(input,0).replay,false);assert.equal(d.begin(input,1).replay,true);
 assert.equal(writes,1);assert.throws(()=>d.begin({...input,content:'Outra mensagem'},0),/CONFLICT/);
 assert.equal(d.view().messages.length,1);assert.equal(advanceBlock(s),'TURN_IN_PROGRESS');
});
test('Envio concorrente, sessão inválida e entrada inválida bloqueados antes de executar',()=>{
 const s=fixture(),d=createPilotDelivery(s,()=>{});
 assert.throws(()=>d.begin({...input,sessionId:'invalid'},0),/SESSION_NOT_FOUND/);
 assert.throws(()=>d.begin({...input,content:''},0),/INVALID_INPUT/);
 d.begin(input,0);assert.throws(()=>d.begin({...input,requestId:'fictional-request-2'},0),/TURN_IN_PROGRESS/);
});
test('Reinício conserva uso/reserva incertos e não reexecuta requisição interrompida',()=>{
 const s=fixture(),before=structuredClone(s.budget),d=createPilotDelivery(s,()=>{});
 d.begin(input,0);const restarted=JSON.parse(JSON.stringify(s));
 const recovered=createPilotDelivery(restarted,()=>{});recovered.recoverRestart();
 assert.equal(restarted.delivery[input.requestId].code,'INTERRUPTED_UNCONFIRMED');
 assert.deepEqual(restarted.budget,before);assert.equal(recovered.begin(input,0).replay,true);
 assert.equal(recovered.view().messages[0].content,input.content);
});
test('Recuperação concluída após reinício não perde resposta nem simula novos custos',()=>{
 const s=fixture(),d=createPilotDelivery(s,()=>{});d.begin(input,0);
 s.delivery[input.requestId]={...s.delivery[input.requestId],status:'completed',result:{text:'Resposta fictícia.'}};
 s.requests[input.requestId]={contentHash:s.delivery[input.requestId].contentHash};
 const r=createPilotDelivery(JSON.parse(JSON.stringify(s)),()=>{});r.recoverRestart();
 assert.equal(r.view().messages[1].content,'Resposta fictícia.');assert.equal(r.begin(input,0).replay,true);
});
test('Validação, serviço e gravação têm códigos e descrições distintos; reserva nunca liberada',()=>{
 for(const code of ['INVALID_MODEL_RESPONSE','MODEL_UNAVAILABLE','STORAGE_UNAVAILABLE']){
  const s=fixture(),budget=structuredClone(s.budget),d=createPilotDelivery(s,()=>{});
  d.begin(input,0);d.finish(input.requestId,code);assert.equal(d.view().deliveries[0].code,code);
  assert.deepEqual(s.budget,budget);assert.equal(d.view().messages[0].content,input.content);
 }
});
test('Falha de gravação do recibo impede execução; falha terminal torna incerteza explícita',()=>{
 const s=fixture();let fail=true;const d=createPilotDelivery(s,()=>{if(fail)throw Error('DISK_FAILURE');});
 assert.throws(()=>d.begin(input,0),/DISK/);assert.equal(s.delivery,undefined);
 fail=false;d.begin(input,0);fail=true;
 assert.throws(()=>d.finish(input.requestId,'MODEL_UNAVAILABLE'),/DISK/);
 assert.equal(d.view().storageFailed,true);assert.equal(d.view().deliveries[0].code,'STORAGE_UNAVAILABLE');
});
test('Commit com falha não fica concluído em memória; não altera reserva e mantém isolamento',async()=>{
 const s=fixture(),d=createPilotDelivery(s,()=>{});d.begin(input,0);
 const before=structuredClone(s);const store=createPilotStore(s,()=>{throw Error('DISK_FAILURE');},identity);
 await assert.rejects(store.repository.commitTurn(scope,{sessionId:sid,requestId:input.requestId,contentHash:'hash',
  expectedCount:0,settingsRevision:'pilot-history-off',context:{messages:[]},status:'active',agent:'MNT',nextCount:1,result:{text:'Fictícia'}}),/DISK/);
 assert.deepEqual(s,before);
 assert.equal(await store.repository.getSession({userId:'other',organizationId:'other'},sid),null);
});
test('Histórico visível vem de mensagens reais e resultado exibido, incluindo falha anterior',()=>{
 const s=fixture();s.audit=[{requestId:'old-failed',messages:[{role:'user',content:'Envio anterior fictício.'}],outcome:'failed',failure:{code:'MODEL_UNAVAILABLE'}},
 {requestId:'old-completed',messages:[{role:'user',content:'Segunda fala fictícia.'}],outcome:'completed',result:{text:'Exibido.'},generation:{closingSummary:'Não exibido.'}}];
 const v=createPilotDelivery(s,()=>{}).view();assert.equal(v.messages.length,3);
 assert.equal(v.messages.some(m=>m.content==='Não exibido.'),false);
 assert.equal(v.deliveries[0].code,'MODEL_UNAVAILABLE');
});
test('Interface usa confirmação própria e consulta sem reenvio; app normal mantém caminho anterior',()=>{
 const pilot=fs.readFileSync('artifacts/iai-web/src/pages/Pilot.tsx','utf8');
 assert.doesNotMatch(pilot,/window\.confirm/);assert.match(pilot,/Confirmar desistência/);
 const chat=fs.readFileSync('artifacts/iai-web/src/pages/Chat.tsx','utf8');
 assert.match(chat,/sessionStorage\.setItem/);assert.match(chat,/\/delivery/);
 assert.match(chat,/if\(pilot\)/);assert.match(chat,/sendLock\.current/);
});
test('Classificação ausente ou incompleta é resposta inválida, não indisponibilidade',async()=>{
 const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
 for(const reason of ['MISSING_CLASSIFICATION','INCOMPLETE_CLASSIFICATION']){
  const s=fixture(),store=createPilotStore(s,()=>{},identity);
  const service=createConversationService({repository:store.repository,classify:async()=>{throw Error(reason);},respond:()=>assert.fail('No generation'),agentPrompts:{}});
  await assert.rejects(service.turn(scope,input),e=>e.code==='INVALID_MODEL_RESPONSE');
 }
});
test('HTTP simulado: desconexão não encerra execução; replay, concorrência, falhas, reinício e autenticação',async()=>{
 const requireApi=Module.createRequire(path.resolve('artifacts/api-server/package.json'));
 const compiled=await requireApi('esbuild').build({entryPoints:['artifacts/api-server/src/routes/pilot.ts'],bundle:true,
  platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
 const m=new Module(path.resolve('artifacts/api-server/fixture-reliability.cjs'),module);
 m.filename=path.resolve('artifacts/api-server/fixture-reliability.cjs');m.paths=Module._nodeModulePaths(path.dirname(m.filename));m._compile(compiled.outputFiles[0].text,m.filename);
 Object.assign(process.env,{NODE_ENV:'development',REPL_OWNER_ID:'fictional-owner',REPL_ID:'fictional-repl',
 REPLIT_DEV_DOMAIN:'pilot.example.invalid',PRIORIS_AI_PROVIDER:'replit',AI_INTEGRATIONS_ANTHROPIC_API_KEY:'fictional-not-secret',
 AI_INTEGRATIONS_ANTHROPIC_BASE_URL:'https://provider.example.invalid'});
 const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'iai-reliability-'));
 const file=path.join(dir,'state.json');fs.writeFileSync(file,JSON.stringify(fixture()));
 let mode='wait',release,entered,calls=0;let started=new Promise(r=>entered=r);
 const model={classify:async()=>{calls++;return {scope:'leadership',job:'compare_paths',confidence:'high'};},
 respond:async()=>{calls++;if(mode==='wait'){entered();await new Promise(r=>release=r);}if(mode==='external')throw Error('SIMULATED_EXTERNAL');if(mode==='invalid')throw Error('UNSUPPORTED_FACT');if(mode==='disk-midcall'){const snapshots=path.join(dir,'snapshots');fs.rmSync(snapshots,{recursive:true});fs.writeFileSync(snapshots,'fictional midcall obstruction');}return {text:'Resposta fictícia simulada.'};}};
 const auth={discovery:async()=>({}),randomPKCECodeVerifier:()=> 'fixture-verifier',randomNonce:()=> 'fixture-nonce',
 randomState:()=> 'fixture-state',calculatePKCECodeChallenge:async()=> 'fixture-challenge',
 buildAuthorizationUrl:()=>new URL('https://auth.example.invalid'),
 authorizationCodeGrant:async()=>({claims:()=>({sub:'fictional-owner'})})};
 let server,base,headers;
 async function start(){
  const app=requireApi('express')();app.use(requireApi('express').json());app.use(requireApi('cookie-parser')());
  app.use('/api/pilot-0.3.0',m.exports.createPilotRouter({stateFile:file,oidcClient:auth,simulatedModel:model,
   client:{messages:{create:()=>assert.fail('Paid provider must never run')}}}));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  base=`http://127.0.0.1:${server.address().port}/api/pilot-0.3.0`;
  const cookie=r=>r.headers.getSetCookie().map(c=>c.split(';')[0]).filter(c=>!c.endsWith('=')).join('; ');
  const flow=cookie(await fetch(base+'/login',{method:'POST',headers:{Origin:'https://pilot.example.invalid'},redirect:'manual'}));
  const owner=cookie(await fetch(base+'/callback?state=fixture-state',{headers:{cookie:flow},redirect:'manual'}));
  headers={cookie:owner,Origin:'https://pilot.example.invalid','Content-Type':'application/json'};
 }
 const post=(body)=>fetch(base+'/session/message',{method:'POST',headers,body:JSON.stringify(body)});
 const view=async()=> (await fetch(base+'/delivery',{headers})).json();
 try{
  await start();
  assert.equal((await fetch(base+'/delivery')).status,401);
  assert.equal((await post({...input,sessionId:'other'})).status,403);assert.equal(calls,0);
  const abort=new AbortController();
  const sending=fetch(base+'/session/message',{method:'POST',headers,body:JSON.stringify(input),signal:abort.signal}).catch(()=>null);
  await started;abort.abort();await sending;
  assert.equal((await view()).deliveries[0].status,'processing');
  const status=await (await fetch(base+'/status',{headers})).json();
  assert.equal(status.abandonConversation.reason,'TURN_IN_PROGRESS');
  assert.equal((await post({...input,requestId:'parallel-request'})).status,409);
  assert.equal((await post(input)).status,200);assert.equal(calls,2);
  release();for(let i=0;i<50&&(await view()).deliveries[0].status==='processing';i++)await new Promise(r=>setTimeout(r,10));
  assert.equal((await view()).messages[1].content,'Resposta fictícia simulada.');
  await post(input);assert.equal(calls,2);assert.equal((await view()).exchangeCount,1);
  mode='invalid';await post({...input,requestId:'invalid-request'});
  assert.equal((await view()).deliveries.at(-1).code,'INVALID_MODEL_RESPONSE');
  mode='external';await post({...input,requestId:'external-request'});
  assert.equal((await view()).deliveries.at(-1).code,'MODEL_UNAVAILABLE');
  const beforeCalls=calls,before=JSON.parse(fs.readFileSync(file));
  const snapshots=path.join(dir,'snapshots');fs.rmSync(snapshots,{recursive:true});fs.writeFileSync(snapshots,'fictional disk obstruction');
  assert.equal((await post({...input,requestId:'diskfail-request'})).status,503);
  assert.equal(calls,beforeCalls);assert.deepEqual(JSON.parse(fs.readFileSync(file)),before);
  fs.rmSync(snapshots);
  await new Promise(r=>server.close(r));await start();
  assert.equal((await view()).exchangeCount,1);
  assert.equal((await view()).messages.some(x=>x.content==='Resposta fictícia simulada.'),true);
  await post(input);assert.equal(calls,beforeCalls);
  // Interrupted request fixture: no model execution on restart or same-id replay.
  await new Promise(r=>server.close(r));
  const interrupted=JSON.parse(fs.readFileSync(file));createPilotDelivery(interrupted,()=>{}).begin({...input,requestId:'interrupted-request'},0);
  fs.writeFileSync(file,JSON.stringify(interrupted));await start();
  assert.equal((await view()).deliveries.at(-1).code,'INTERRUPTED_UNCONFIRMED');
  await post({...input,requestId:'interrupted-request'});assert.equal(calls,beforeCalls);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).budget,before.budget);
  mode='disk-midcall';
  const failure=await post({...input,requestId:'midcall-storage'});
  assert.equal(failure.status,503);assert.equal((await failure.json()).code,'STORAGE_UNAVAILABLE');
  assert.equal((await view()).deliveries.at(-1).code,'STORAGE_UNAVAILABLE');
  assert.equal((await view()).storageFailed,true);
  const countAfterStorage=calls;await post({...input,requestId:'midcall-storage'});assert.equal(calls,countAfterStorage);
  fs.rmSync(path.join(dir,'snapshots'));
 }finally{if(server?.listening)await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
