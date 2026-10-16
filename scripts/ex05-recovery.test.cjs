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
