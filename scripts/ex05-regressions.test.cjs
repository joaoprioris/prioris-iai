'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {validateMethodologicalFidelity}=require('../artifacts/api-server/src/lib/methodological-fidelity.cjs');
const {resolveContract}=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
const profile=resolveContract().agents.find(a=>a.id==='FBK');
const facts='Em duas reuniões, Camila interrompeu colegas e chamou suas propostas de básicas.';
const request='Pode me dar um exemplo curto de abertura, baseado no que eu presenciei?';
const messages=[{role:'user',content:facts},{role:'user',content:request}];
const example=()=>({text:'Os episódios que você presenciou são uma base diferente dos relatos de terceiros. O exemplo abaixo é apenas uma abertura para você adaptar.',stage:'explore',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',operationalClaims:[],delivery:{kind:'message',text:'Quero conversar sobre duas reuniões em que vi interrupções e comentários sobre as propostas dos colegas.'},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:1,quote:request}],basisEvidence:[{message:0,quote:facts}],examplePurpose:'Apoiar uma abertura pontual pedida pela líder, distinguindo observação e relato.'}});
test('Recusa certeza sobre a dificuldade real sem relato que a sustente',()=>{
 assert.throws(()=>validateMethodologicalFidelity({},messages,['A dificuldade real não é a reação dela; é que você ainda não definiu o que precisa mudar.']),/UNSUPPORTED_FACT/);
});
test('Condição de fala proposta não autoriza causalidade escondida na sugestão',()=>{
 assert.throws(()=>validateMethodologicalFidelity({},messages,['Se você abrir dizendo que isso criou um efeito de evitação na equipe, o que fica frágil?']),/UNSUPPORTED_FACT/);
});
test('Hipótese causal explícita e pergunta aberta sobre lacuna continuam possíveis',()=>{
 assert.equal(typeof validateMethodologicalFidelity({},messages,['Talvez essa seja uma dificuldade; não sabemos se os episódios causaram a evitação.']),'string');
});
test('Exemplo curto solicitado apoia elaboração com fatos sem exigir fala previamente pronta',()=>{
 const r=validateProgress(example(),profile,messages,{number:3});assert.equal(r.progress.authorship.supportMode,'optional_example');assert.equal(r.progress.authorship.approachEvidence.length,0);assert.equal(r.progress.authorship.requestEvidence[0].quote,request);assert.equal(r.progress.authorship.basisEvidence[0].quote,facts);assert.match(r.text,/Exemplo opcional/);
});
test('Fatos sozinhos não autorizam exemplo automático sem abordagem própria',()=>{
 const v=example();delete v.authorship.requestEvidence;assert.throws(()=>validateProgress(v,profile,messages,{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Pedido explícito sozinho não autoriza exemplo sem base factual',()=>{
 const v=example();delete v.authorship.basisEvidence;assert.throws(()=>validateProgress(v,profile,messages,{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Citação inventada continua recusada mesmo com pedido de exemplo',()=>{
 const v=example();v.authorship.basisEvidence=[{message:0,quote:'Camila ameaçou os colegas.'}];assert.throws(()=>validateProgress(v,profile,messages,{number:1}),/INVALID_PROGRESS_EVIDENCE/);
});
test('Pedido explícito não transforma abertura pontual em discurso completo',()=>{
 const v=example();v.delivery.text=Array(45).fill('argumento').join(' ');assert.throws(()=>validateProgress(v,profile,messages,{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Negar ou retirar pedido não autoriza exemplo por presença de palavra',()=>{
 const v=example(),negative='Não quero um exemplo; preciso pensar no problema.';v.authorship.requestEvidence=[{message:1,quote:negative}];
 assert.throws(()=>validateProgress(v,profile,[messages[0],{role:'user',content:negative}],{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
 assert.throws(()=>validateProgress(example(),profile,[...messages,{role:'user',content:negative}],{number:2}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Relatar que outra pessoa pediu exemplo não autoriza fala pronta ao líder',()=>{
 const reported='Minha colega pediu um exemplo de abertura.';const v=example();v.authorship.requestEvidence=[{message:1,quote:reported}];
 assert.throws(()=>validateProgress(v,profile,[messages[0],{role:'user',content:reported}],{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Exemplo solicitado não autoriza causalidade não relatada dentro do delivery',()=>{
 const v=example();v.delivery.text='Isso criou um efeito de evitação na equipe.';
 assert.throws(()=>validateProgress(v,profile,messages,{number:2}),/UNSUPPORTED_FACT/);
});
test('Fato conciso continua base possível para exemplo explicitamente pedido',()=>{
 const short='Ela gritou comigo.';const v=example();v.authorship.basisEvidence=[{message:0,quote:short}];v.delivery.text='Quero conversar sobre o episódio em que você gritou comigo.';
 assert.equal(validateProgress(v,profile,[{role:'user',content:short},messages[1]],{number:1}).progress.authorship.basisEvidence[0].quote,short);
});
test('Metadado de fatos não se transforma em abordagem para desativar limite do exemplo',()=>{
 const v=example();v.authorship.approachEvidence=[{message:0,quote:facts}];v.delivery.text=Array(45).fill('argumento').join(' ');
 assert.throws(()=>validateProgress(v,profile,messages,{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Condicional de outra oração não imuniza diagnóstico categórico',()=>{
 assert.throws(()=>validateMethodologicalFidelity({},messages,['A dificuldade real é sua insegurança; se quiser, examinamos isso.']),/UNSUPPORTED_FACT/);
});
test('Recusar atribuição causal continua permitido',()=>{
 assert.equal(typeof validateMethodologicalFidelity({},messages,['Não vou dizer que isso criou a evitação.']),'string');
});
test('Pedido citado de terceiro não é autorização mesmo com a pergunta literal',()=>{
 const reported='Minha colega perguntou: Pode me dar um exemplo de abertura?';const quote='Pode me dar um exemplo de abertura?';const v=example();v.authorship.requestEvidence=[{message:1,quote}];assert.throws(()=>validateProgress(v,profile,[messages[0],{role:'user',content:reported}],{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Pedido de exemplo com restrição de extensão não é retirada',()=>{
 const short='Pode me dar um exemplo sem uma fala longa?';const v=example();v.authorship.requestEvidence=[{message:1,quote:short}];assert.equal(validateProgress(v,profile,[messages[0],{role:'user',content:short}],{number:1}).progress.authorship.supportMode,'optional_example');
});
test('Negação de outra proposição não libera atribuição causal afirmativa',()=>{
 assert.throws(()=>validateMethodologicalFidelity({},messages,['Não vou dizer que isso foi simples, mas vou dizer que isso criou evitação.']),/UNSUPPORTED_FACT/);
});
test('Reparo real do adaptador recebe contagem das perguntas rejeitadas',async()=>{
 const path=require('node:path'),Module=require('node:module');const api=Module.createRequire(path.resolve('artifacts/api-server/package.json'));
 const built=api('esbuild').buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
 const filename=path.resolve('artifacts/api-server/ex05-test.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(built.outputFiles[0].text,filename);
 const mentor=resolveContract().agents.find(a=>a.id==='MNT'),calls=[];
 const envelope=text=>({text,stage:'clarify',completed:[],pending:mentor.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:'',operationalClaims:[]});
 const values=[envelope('O problema ainda tem lacunas. Que resultado você busca? Que evidência está faltando?'),envelope('Falta separar desempenho da pessoa e condições da operação. Que evidência indica que a troca resolveria o problema?')];
 const p=m.exports.createModelProviders({client:{messages:{create:async payload=>{calls.push(payload);return {stop_reason:'tool_use',content:[{type:'tool_use',name:payload.tool_choice.name,input:values.shift()}],usage:{input_tokens:0,output_tokens:0}};}}}});
 const payload={agent:'MNT',system:mentor.prompt,messages:[{role:'user',content:'Quero comparar alternativas.'}],history:[],turn:{number:1,max:10}};
 const result=await p.respond(payload);assert.equal(calls.length,2);assert(calls[1].system.includes('2 perguntas ao líder, 0 ao interlocutor'));assert(calls[1].system.length<3500);assert.equal(calls[1].tools[0].name,'revisar_apresentacao');assert.equal(calls[1].max_tokens,600);assert.equal(result.progress.stage,'clarify');assert.equal((result.text.match(/\?/g)??[]).length,1);
});
