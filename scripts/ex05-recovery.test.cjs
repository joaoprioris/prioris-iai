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
