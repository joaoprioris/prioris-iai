'use strict';
// Compile the current adapter with a database that throws and a fully injected
// SDK. This exercises the real prompt/recovery path, not an external provider.
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),Module=require('node:module');
const esbuild=require(path.resolve('artifacts/api-server/node_modules/esbuild'));
const output=esbuild.buildSync({
 entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],
 bundle:true,platform:'node',format:'cjs',packages:'external',write:false,
 alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')},
});
const filename=path.resolve('artifacts/api-server/isolated-one-to-one-adapter.cjs');
const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(output.outputFiles[0].text,filename);
const {createModelProviders,createFunctionalRouter}=m.exports;
const profile=require('../artifacts/api-server/src/lib/agent-contract.json').agents.find(a=>a.id==='OTO');
const {ROUTING_VERSION}=require('../artifacts/api-server/src/lib/functional-policy.cjs');
const calls=[];
const envelope=text=>({text,stage:'direct',completed:[],pending:profile.diagnostic_criteria.map(c=>c.id),lenses:[],closingSummary:'',nextStep:''});
function provider(values){
 return createModelProviders({client:{messages:{create:async payload=>{
  calls.push(payload);const input=values.shift();if(input instanceof Error)throw input;
  return {stop_reason:'tool_use',content:[{type:'tool_use',name:payload.tool_choice.name,input}],usage:{input_tokens:0,output_tokens:0}};
 }}}});
}
const payload={agent:'OTO',system:profile.prompt,messages:[{role:'user',content:'Estou numa reunião e estão questionando minha decisão. Estou começando a ceder.'}],history:[],turn:{number:1,max:10,situationReading:{state:'DURING',evidence:'Estou numa reunião'}}};
test('Prompt e esquema reais usam condução ao vivo e cinco estados',async()=>{
 const input={scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true,situationState:'DURING',stateEvidence:'Estou numa reunião'};
 const p=provider([input]);await p.classify({messages:payload.messages,history:[],previousAgent:null});
 const request=calls.at(-1);
 assert.match(request.system,/bilateral ou em grupo/);assert.match(request.system,/Vazio não presume incapacidade/);
 assert.doesNotMatch(request.system,/close_bilateral|bilateralConversation/);
 assert(request.tools[0].input_schema.properties.job.enum.includes('conduct_live'));
 assert(request.tools[0].input_schema.properties.situationState.enum.includes(null));
});
test('Condução em tensão usa microdirecionamento sem exigir alvo',async()=>{
 const p=provider([{...envelope('A decisão está sendo questionada; a tensão relatada é começar a ceder.'),delivery:{kind:'micro_move',text:'Vamos retomar o ponto que vocês estão questionando, um de cada vez.'}}]);
 const result=await p.respond(payload);
 assert.equal(result.progress.deliveryKind,'micro_move');assert.equal(result.progress.version,ROUTING_VERSION);
 assert.match(calls.at(-1).system,/Não exija compromisso-alvo/);assert.match(result.text,/uma formulação|Uma formulação/);
});
test('Duas respostas inválidas recuperam contexto sem perguntar por compromisso',async()=>{
 const p=provider([envelope('Quando? Onde? Por quê?'),envelope('Quando? Onde? Por quê?')]);
 const r=await p.respond(payload);assert.match(r.text,/Não consegui organizar/);assert.match(r.text,/acontecendo na conversa agora/);assert.doesNotMatch(r.text,/compromisso|bilateral/);
});
test('Falha do serviço não vira resposta falsa',async()=>{
 await assert.rejects(provider([new Error('SYNTHETIC_OUTAGE')]).respond(payload),/SYNTHETIC_OUTAGE/);
});
test('Recuperação na décima troca reconhece lacunas e encerra sem compromisso',async()=>{
 const r=await provider([envelope('Quando? Onde?'),envelope('Quando? Onde?')]).respond({...payload,turn:{number:10,max:10}});
 assert.equal(r.progress.stage,'close');assert.equal(r.progress.version,ROUTING_VERSION);assert.match(r.text,/lacunas/);assert.doesNotMatch(r.text,/compromisso/);
});
test('Router padrão não serve o fluxo novo; instância isolada pode ser opt-in sem variável global',()=>{
 const repository={};const classify=async()=>({}),respond=async()=>({});
 const previous=process.env.PRIORIS_FUNCTIONAL_ROUTING_V1;
 delete process.env.PRIORIS_FUNCTIONAL_ROUTING_V1;
 try{
  let result;const standard=createFunctionalRouter({repository,classify,respond});
  standard.stack[0].handle({}, {},value=>{result=value});assert.equal(result,'router');
  result=undefined;const pilot=createFunctionalRouter({repository,classify,respond,enabled:()=>true});
  pilot.stack[0].handle({}, {},value=>{result=value});assert.equal(result,undefined);
  assert.equal(process.env.PRIORIS_FUNCTIONAL_ROUTING_V1,undefined);
 }finally{if(previous!==undefined)process.env.PRIORIS_FUNCTIONAL_ROUTING_V1=previous;}
});
