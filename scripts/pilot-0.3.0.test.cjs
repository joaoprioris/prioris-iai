'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {mkdtempSync,readFileSync}=require('node:fs'),{tmpdir}=require('node:os'),path=require('node:path'),Module=require('node:module');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const {createPilotStore,IDENTITY}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const scope={userId:IDENTITY.id,organizationId:IDENTITY.organizationId};
const payload=(model='claude-sonnet-4-5',extra='')=>({model,max_tokens:model.includes('haiku')?600:2200,system:'Instrução fictícia '+extra,tools:[{name:'ficticio',input_schema:{type:'object'}}],messages:[{role:'user',content:'Fala fictícia de teste.'}]});
const usage={input_tokens:100,output_tokens:60};
test('Reserva inclui payload completo, 2200 de saída e margem; classificador e recuperação são contabilizados separadamente',async()=>{
 const state={},b=createPilotBudget(state);
 const p=payload();const expected=(Buffer.byteLength(JSON.stringify(p))*2+8192)*6+2200*15;
 await b.call(payload('claude-haiku-4-5'),async()=>({usage}));
 await b.call(p,async()=>({usage}));
 await b.call(payload('claude-sonnet-4-5','Refaça a resposta após validação.'),async()=>({usage}));
 assert.equal(state.calls.length,3);assert.equal(state.calls[1].reservedMicroUSD,expected);
 assert.equal(state.calls[2].maxOutput,2200);assert(state.calls[2].reservedMicroUSD>expected);
 assert.equal(state.charged,100+60*5+2*(100*3+60*15));
});
test('Teto de US$1 rejeita reserva antes de enviar e permanece após recriar o ledger',async()=>{
 const state={charged:999999};let calls=0;const b=createPilotBudget(state);
 await assert.rejects(b.call(payload(),async()=>{calls++;return {usage};}),/BUDGET_LIMIT/);
 assert.equal(calls,0);assert.equal(b.snapshot().blocked,true);
 const restored=createPilotBudget(JSON.parse(JSON.stringify(state)));
 await assert.rejects(restored.call(payload(),async()=>{calls++;}),/BUDGET_BLOCKED/);assert.equal(calls,0);
});
test('Erro de serviço e uso ausente retêm reserva; ausência de medição bloqueia chamadas',async()=>{
 const state={},b=createPilotBudget(state);
 await assert.rejects(b.call(payload(),async()=>{throw Error('FICTITIOUS_OUTAGE');}),/FICTITIOUS_OUTAGE/);
 assert(state.charged>0);assert.equal(state.calls[0].status,'uncertain-held');
 await assert.rejects(b.call(payload(),async()=>({})),/USAGE_UNVERIFIED/);
 assert.equal(state.calls[1].status,'unknown-usage-held');assert(b.snapshot().blocked);
});
test('Modelo, saída excessiva, contexto excessivo e thinking são negados sem chamada',async()=>{
 let calls=0;const send=async()=>{calls++;return {usage};};
 for(const p of [{...payload(),model:'unknown'},{...payload(),max_tokens:2201},{...payload(),thinking:{type:'enabled'}},payload('claude-sonnet-4-5','x'.repeat(100000))]){
  await assert.rejects(createPilotBudget({}).call(p,send));
 }
 assert.equal(calls,0);
});
test('Reservas concorrentes não ultrapassam teto; falha de persistência impede envio',async()=>{
 const state={charged:900000},b=createPilotBudget(state);let calls=0;
 await Promise.allSettled([b.call(payload(),async()=>{calls++;throw Error('ficticio');}),b.call(payload(),async()=>{calls++;throw Error('ficticio');})]);
 assert.equal(calls,1);assert(state.charged<=1000000);
 await assert.rejects(createPilotBudget({},()=>{throw Error('WRITE_DENIED');}).call(payload(),async()=>{calls++;}),/WRITE_DENIED/);
 assert.equal(calls,1);
});
test('Uma sessão fictícia, contagem global 10, nega escopo alheio, repetição e 11ª troca; sem histórico',async()=>{
 const state={},store=createPilotStore(state),session=store.open(scope);
 assert.equal(store.open(scope).id,session.id);
 const wrong={...scope,userId:'other-fictional-person'};
 assert.equal(await store.repository.getSession(wrong,session.id),null);assert.throws(()=>store.open(wrong),/SCOPE_DENIED/);
 assert.equal((await store.repository.getHistorySettings(scope)).enabled,false);
 const service=createConversationService({repository:store.repository,
  classify:async()=>({scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true}),
  respond:async()=> 'Resposta local fictícia.',agentPrompts:{OTO:'Instrução fictícia'}});
 for(let n=1;n<=10;n++){const r=await service.turn(scope,{sessionId:session.id,requestId:'request-local-'+n,content:'Fala fictícia '+n});assert.equal(r.exchangeCount,n);}
 assert.equal(state.session.status,'closed');assert.equal(state.session.context.messages,undefined);
 await assert.rejects(service.turn(scope,{sessionId:session.id,requestId:'request-local-10',content:'Fala fictícia 10'}),e=>e.code==='REQUEST_ALREADY_COMPLETED');
 await assert.rejects(service.turn(scope,{sessionId:session.id,requestId:'request-local-11',content:'Fala fictícia 11'}),e=>e.code==='SESSION_CLOSED');
 assert.equal(store.open(scope).id,session.id);assert.equal(store.open(scope).exchangeCount,10);
});

// Actual route, OIDC and SDK replaced only in this isolated test. Database
// module throws if used; state resides under /tmp, never the real pilot ledger.
const esbuild=require(path.resolve('artifacts/api-server/node_modules/esbuild'));
process.env.NODE_ENV='test'; // prevent module default instance initialization
const output=esbuild.buildSync({entryPoints:['artifacts/api-server/src/routes/pilot.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
const filename=path.resolve('artifacts/api-server/isolated-pilot-test.cjs'),m=new Module(filename,module);
m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(output.outputFiles[0].text,filename);
const {createPilotRouter}=m.exports;
const requireApi=m.require.bind(m),express=requireApi('express'),cookieParser=requireApi('cookie-parser');
test('Acesso real da rota: origem/owner/estado inválidos negados; proprietário fictício entra sem e-mail; logout e produção bloqueiam',async()=>{
 process.env.NODE_ENV='development';process.env.REPL_OWNER_ID='owner-fixture-only';process.env.REPL_ID='repl-fixture-only';process.env.REPLIT_DEV_DOMAIN='pilot.example.invalid';
 const origin='https://pilot.example.invalid';let subject='other-fixture',aiCalls=0,grants=0;const replies=[];
 const localAuth={discovery:async()=>({}),randomPKCECodeVerifier:()=> 'verifier-fixture',randomNonce:()=> 'nonce-fixture',randomState:()=> 'state-fixture',calculatePKCECodeChallenge:async()=> 'challenge-fixture',buildAuthorizationUrl:()=>new URL('https://auth.example.invalid/login'),
  authorizationCodeGrant:async(_c,url,checks)=>{grants++;assert.equal(checks.expectedNonce,'nonce-fixture');assert.equal(checks.pkceCodeVerifier,'verifier-fixture');if(url.searchParams.get('state')!==checks.expectedState)throw Error('STATE_INVALID');return {claims:()=>({sub:subject})};}};
 const file=path.join(mkdtempSync(path.join(tmpdir(),'iai-pilot-')),'state.json');
 const app=express();app.use(cookieParser());app.use(express.json());
 app.use('/api/pilot-0.3.0',createPilotRouter({oidcClient:localAuth,stateFile:file,client:{messages:{create:async p=>{
  aiCalls++;if(!replies.length)throw Error('FICTITIOUS_OUTAGE');
  return {usage,stop_reason:'tool_use',content:[{type:'tool_use',name:p.tool_choice.name,input:replies.shift()}]};
 }}}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const url='http://127.0.0.1:'+server.address().port+'/api/pilot-0.3.0';
 const request=(route,options={})=>fetch(url+route,{redirect:'manual',...options});
 const cookie=r=>r.headers.getSetCookie().at(-1).split(';')[0];
 const callback=(flow,state='state-fixture')=>request('/callback?state='+state+'&code=fixture',{headers:{cookie:flow}});
 try{
  assert.equal((await request('/sessions',{method:'POST',headers:{Origin:origin}})).status,401);
  assert.equal((await request('/login',{method:'POST',headers:{Origin:'https://evil.example.invalid'}})).status,403);
  assert.equal((await request('/callback?state=bad&code=fixture')).status,403);
  let flow=cookie(await request('/login',{method:'POST',headers:{Origin:origin}}));
  assert.equal((await callback(flow,'bad')).status,403);
  flow=cookie(await request('/login',{method:'POST',headers:{Origin:origin}}));
  assert.equal((await callback(flow)).status,403);
  subject='owner-fixture-only';flow=cookie(await request('/login',{method:'POST',headers:{Origin:origin}}));
  const accepted=await callback(flow);assert.equal(accepted.status,302);
  const ownerCookie=cookie(accepted);
  assert.match(accepted.headers.get('set-cookie'),/HttpOnly/);assert.match(accepted.headers.get('set-cookie'),/Secure/);
  assert.equal((await request('/status',{headers:{cookie:'__Secure-iai-pilot-owner=forged'}}).then(r=>r.json())).authenticated,false);
  const status=await request('/status',{headers:{cookie:ownerCookie}}).then(r=>r.json());
  assert.equal(status.authenticated,true);assert.equal(status.identity.id,'00000000-0000-4000-8000-000000000303');assert.equal(aiCalls,0);
  const headers={Origin:origin,cookie:ownerCookie,'Content-Type':'application/json'};
  const s1=await request('/sessions',{method:'POST',headers}).then(r=>r.json());
  const s2=await request('/sessions',{method:'POST',headers}).then(r=>r.json());assert.equal(s1.id,s2.id);
  assert.equal(aiCalls,0);
  assert.equal((await request('/session/message',{method:'POST',headers,body:JSON.stringify({sessionId:'wrong-fixture',requestId:'fictional-request-1',content:'Teste fictício'})})).status,403);
  assert.equal(aiCalls,0);
  const failed=await request('/session/message',{method:'POST',headers,body:JSON.stringify({sessionId:s1.id,requestId:'fictional-request-2',content:'Teste fictício'})});
  assert.equal(failed.status,503);assert.equal(aiCalls,1);
  let after=JSON.parse(readFileSync(file,'utf8'));assert(after.budget.charged>0);assert.equal(after.session.exchangeCount,0);
  const profile=require('../artifacts/api-server/src/lib/agent-contract.json').agents.find(a=>a.id==='OTO');
  const invalid={text:'Quando? Onde? Por quê?',stage:'direct',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:''};
  replies.push({scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true},invalid,invalid);
  const recovered=await request('/session/message',{method:'POST',headers,body:JSON.stringify({sessionId:s1.id,requestId:'fictional-request-3',content:'Conversa fictícia em curso.'})});
  assert.equal(recovered.status,200);assert.match(await recovered.text(),/Não consegui organizar/);
  after=JSON.parse(readFileSync(file,'utf8'));assert.equal(aiCalls,4);assert.equal(after.session.exchangeCount,1);
  assert.deepEqual(after.budget.calls.map(c=>c.maxOutput),[600,600,2200,2200]);
  assert.deepEqual(after.budget.calls.map(c=>c.status),['uncertain-held','accounted','accounted','accounted']);
  assert(after.budget.charged<=1000000);
  assert.equal((await request('/logout',{method:'POST',headers})).status,200);
  assert.equal((await request('/sessions',{method:'POST',headers})).status,401);
  assert(!JSON.stringify(after).includes('owner-fixture-only'));assert(grants>=3);
 }finally{await new Promise(resolve=>server.close(resolve));}
 process.env.NODE_ENV='production';
 const prod=createPilotRouter({stateFile:file});assert.equal(prod.stack.length,0);
});
