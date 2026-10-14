'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {createPilotPersistence}=require('../artifacts/api-server/src/lib/pilot-persistence.cjs');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const api=Module.createRequire(path.resolve('artifacts/api-server/package.json'));
const temp=()=>fs.mkdtempSync(path.join(require('node:os').tmpdir(),'iai-consistency-'));
test('Dois estados carregados do mesmo arquivo: escritor atrasado não pode retroceder despesas/conversa',()=>{
 const dir=temp(),file=dir+'/state.json';try{
 fs.writeFileSync(file,JSON.stringify({round:20,budget:{charged:4253750,calls:[]},session:{exchangeCount:0}}));
 const a=JSON.parse(fs.readFileSync(file)),b=JSON.parse(fs.readFileSync(file));
 const pa=createPilotPersistence(file,a),pb=createPilotPersistence(file,b);
 a.budget.charged=4289318;a.session.exchangeCount=1;pa.save();
 b.session.exchangeCount=0;assert.throws(()=>pb.save(),/STATE_CONFLICT/);
 assert.equal(JSON.parse(fs.readFileSync(file)).budget.charged,4289318);
 pb.refresh();assert.equal(b.session.exchangeCount,1);assert.equal(b.budget.charged,4289318);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Lease durável bloqueia outro escritor e reinício, sem expirar por desconexão',()=>{
 const dir=temp(),file=dir+'/state.json';try{
 const s={budget:{}};fs.writeFileSync(file,JSON.stringify(s));
 const a=createPilotPersistence(file,s),b=createPilotPersistence(file,structuredClone(s));
 const release=a.acquireRequest();assert(b.requestActive());assert.throws(()=>b.acquireRequest(),/TURN_IN_PROGRESS/);
 const restarted=createPilotPersistence(file,structuredClone(s));assert(restarted.requestActive());
 release();assert.equal(restarted.requestActive(),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Piso observado e margem desconhecida não inventam chamadas nem usage no ledger',()=>{
 const s={cap:5000000,charged:5000000,calls:[{kind:'recovered-ui-summary',callCount:168,estimatedMicroUSD:4253750}],
  observedCallFloor:170,observedChargeFloor:4289318,additionalUncertainHoldMicroUSD:710682,blocked:true};
 const before=JSON.stringify(s.calls),snapshot=createPilotBudget(s,()=>{}).snapshot();
 assert.equal(snapshot.calls,170);assert.equal(snapshot.ledgerEntries,1);assert.equal(snapshot.remainingUSD,0);
 assert.equal(snapshot.observedMinimumUSD,4.289318);assert.equal(snapshot.additionalUncertainHoldUSD,.710682);
 assert.equal(JSON.stringify(s.calls),before);
});
test('Processo local ausente é incerteza, não execução ativa nem permissão de repetir',()=>{
 const dir=temp(),file=dir+'/state.json';try{
  fs.writeFileSync(file,'{}');const p=createPilotPersistence(file,{});
  p.acquireRequest();
  fs.writeFileSync(file+'.request-lock/owner.json',JSON.stringify({pid:99999999,writer:'orphan-fixture',processIdentity:'absent'}));
  assert.equal(p.requestActive(),false);assert.throws(()=>p.acquireRequest(),/TURN_IN_PROGRESS/);
  assert(fs.existsSync(file+'.request-lock'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Recuperação externa mostra resposta uma vez e conserva segundo envio desconhecido',()=>{
 const {createPilotDelivery}=require('../artifacts/api-server/src/lib/pilot-delivery.cjs');
 const s={audit:[],session:{context:{messages:[{role:'user',content:'Primeira fala fictícia.'},{role:'assistant',content:'Resposta observada.'}]}},
 delivery:{one:{requestId:'one',content:'Primeira fala fictícia.',source:'external-observation',status:'completed',result:{text:'Resposta observada.'}},
 two:{requestId:'two',content:'Segunda fala fictícia.',source:'external-observation',status:'uncertain',code:'RESULT_UNCONFIRMED'}}};
 const view=createPilotDelivery(s,()=>assert.fail('Read must not write')).view();
 assert.equal(view.messages.length,3);assert.equal(view.messages.filter(m=>m.role==='assistant').length,1);
 assert.equal(view.deliveries[1].code,'RESULT_UNCONFIRMED');
});
function loadRouter(source){
 const old=process.env.NODE_ENV;process.env.NODE_ENV='test';
 const built=api('esbuild').buildSync({stdin:{contents:source,resolveDir:path.resolve('artifacts/api-server/src/routes'),sourcefile:'pilot.ts',loader:'ts'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
 const m=new Module(path.resolve('artifacts/api-server/fixture-consistency.cjs'),module);
 m.filename=path.resolve('artifacts/api-server/fixture-consistency.cjs');m.paths=Module._nodeModulePaths(path.dirname(m.filename));m._compile(built.outputFiles[0].text,m.filename);
 process.env.NODE_ENV=old;return m.exports.createPilotRouter;
}
const legacy=loadRouter(fs.readFileSync('generated-artifacts/pilot-consistency-preserved/pilot.ts','utf8'));
const corrected=loadRouter(fs.readFileSync('artifacts/api-server/src/routes/pilot.ts','utf8'));
function fixture(){return {version:'0.3.4',provider:'replit',round:20,expiresAt:Date.now()+7200000,budget:{currentRound:20,cap:5000000,charged:4253750,calls:[{kind:'recovered-ui-summary',callCount:168,estimatedMicroUSD:4253750}],blocked:false},audit:[],requests:{},archivedRounds:[]};}
async function scenario(create,{legacyMode=false}={}){
 const dir=temp(),file=dir+'/state.json';fs.writeFileSync(file,JSON.stringify(fixture()));
 Object.assign(process.env,{NODE_ENV:'development',REPLIT_DEV_DOMAIN:'pilot.example.invalid',REPL_OWNER_ID:'owner-fixture-only',REPL_ID:'repl-fixture-only',
 AI_INTEGRATIONS_ANTHROPIC_API_KEY:'fixture-not-secret',AI_INTEGRATIONS_ANTHROPIC_BASE_URL:'https://provider.example.invalid',PRIORIS_AI_PROVIDER:'replit'});
 const auth={discovery:async()=>({}),randomPKCECodeVerifier:()=> 'verifier',randomNonce:()=> 'nonce',randomState:()=> 'state',
 calculatePKCECodeChallenge:async()=> 'challenge',buildAuthorizationUrl:()=>new URL('https://auth.example.invalid'),
 authorizationCodeGrant:async()=>({claims:()=>({sub:'owner-fixture-only'})})};
 let calls=0,gate=null,entered;
 const profile=require('../artifacts/api-server/src/lib/agent-contract.json').agents.find(p=>p.id==='MNT');
 const client={messages:{create:async payload=>{
  calls++;if(gate){entered();await gate;}
  const classifier=payload.model.includes('haiku');
  return {stop_reason:'tool_use',content:[{type:'tool_use',name:payload.tool_choice.name,input:classifier?{scope:'leadership',job:'compare_paths',confidence:'high'}:
  {text:'Há uma escolha em aberto; falta examinar o critério relevante. Que critério você está considerando?',stage:'explore',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',operationalClaims:[]}}],
 usage:{input_tokens:100,output_tokens:10}};
 }}};
 // Truly separate loaded router states and budget closures share one file.
 const a=create({stateFile:file,oidcClient:auth,client}),b=create({stateFile:file,oidcClient:auth,client});
 const app=api('express')();app.use(api('express').json());app.use(api('cookie-parser')());app.use('/a',a);app.use('/b',b);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=(route,method='GET',body,owner)=>fetch(base+route,{method,redirect:'manual',headers:{Origin:'https://pilot.example.invalid','Content-Type':'application/json',...(owner?{cookie:owner}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const cookie=r=>r.headers.getSetCookie().map(c=>c.split(';')[0]).filter(c=>!c.endsWith('=')).join('; ');
 const login=async prefix=>{const flow=cookie(await request(prefix+'/login','POST'));return cookie(await request(prefix+'/callback?state=state','GET',null,flow));};
 try{
  const ownerA=await login('/a'),ownerB=legacyMode?await login('/b'):ownerA;
  const session=await (await request('/a/sessions','POST',{},ownerA)).json();
  const first={sessionId:session.id,requestId:'fictional-first-send',content:'Quero comparar duas opções fictícias.'};
  assert.equal((await request('/a/session/message','POST',first,ownerA)).status,200);assert.equal(calls,2);
  const firstStatus=await (await request('/a/status','GET',null,ownerA)).json();assert.equal(firstStatus.budget.calls,170);
  await request('/b/sessions','POST',{},ownerB);
  const disk=JSON.parse(fs.readFileSync(file));
  if(legacyMode){assert.equal(disk.budget.calls[0].callCount,168);assert.equal(disk.session.exchangeCount,0);assert.equal(disk.budget.charged,4253750);return;}
  assert.equal(disk.session.exchangeCount,1);assert.equal(disk.session.id,session.id);assert.equal(disk.budget.calls.length,3);
  const bstatus=await (await request('/b/status','GET',null,ownerB)).json();assert.equal(bstatus.budget.calls,170);assert(bstatus.authenticated);
  assert.equal((await request('/b/session/message','POST',first,ownerB)).status,200);assert.equal(calls,2);
  const view=await (await request('/b/delivery','GET',null,ownerB)).json();assert.equal(view.exchangeCount,1);assert(view.messages.some(m=>m.role==='assistant'));
  const reloaded=create({stateFile:file,oidcClient:auth,client});app.use('/c',reloaded);
  assert((await (await request('/c/status','GET',null,ownerA)).json()).authenticated);
  assert.equal((await (await request('/c/delivery','GET',null,ownerA)).json()).exchangeCount,1);
  let release;gate=new Promise(r=>release=r);const started=new Promise(r=>entered=r);
  const second={...first,requestId:'fictional-second-send',content:'Outra alternativa fictícia.'};
  const controller=new AbortController();
  const pending=fetch(base+'/a/session/message',{method:'POST',headers:{cookie:ownerA,Origin:'https://pilot.example.invalid','Content-Type':'application/json'},body:JSON.stringify(second),signal:controller.signal}).catch(()=>null);
  await started;controller.abort();await pending;
  assert.equal((await request('/b/session/message','POST',{...second,requestId:'concurrent-other-id'},ownerB)).status,409);
  assert.equal((await (await request('/b/status','GET',null,ownerB)).json()).abandonConversation.reason,'TURN_IN_PROGRESS');
  gate=null;release();for(let i=0;i<50&&JSON.parse(fs.readFileSync(file)).session.exchangeCount<2;i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(JSON.parse(fs.readFileSync(file)).session.exchangeCount,2);
  assert.equal((await (await request('/b/status','GET',null,ownerB)).json()).budget.calls,172);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
}
test('Reprodução contra o router anterior real: instância atrasada apaga respostas e volta 170→168',()=>scenario(legacy,{legacyMode:true}));
test('Router corrigido: estados independentes, recuperação, autenticação após reinício e envio desconectado',()=>scenario(corrected));
