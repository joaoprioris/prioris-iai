'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createConversationService,NOTICE_VERSION}=require('./conversation-service.cjs');
const scope={userId:'test-user',organizationId:'test-org'};
const input={sessionId:'test-session',requestId:'test-request-001',content:'Quero comparar caminhos.'};
const analysis={scope:'leadership',job:'compare_paths',confidence:'high'};
function fixture(overrides={}) {
 const state={session:{id:'test-session',status:'active',exchangeCount:0,context:{}},settings:{enabled:false,noticeVersion:null,revision:'0'},history:[],classifyCalls:0,responseCalls:0,commits:[],privateReads:0};
 const repository={getSession:async(s,id)=>s.userId===scope.userId&&s.organizationId===scope.organizationId&&id==='test-session'?state.session:null,
 getHistorySettings:async()=>state.settings,readPrivateHistory:async()=>{state.privateReads++;return state.history},
 commitTurn:async(s,t)=>{if(t.settingsRevision!==state.settings.revision||t.expectedCount!==state.session.exchangeCount)return false;state.commits.push(t);state.session={...state.session,context:t.context,status:t.status,exchangeCount:t.nextCount};return true}};
 const service=createConversationService({repository,classify:async payload=>{state.classifyCalls++;return overrides.classify?overrides.classify(payload,state):analysis},respond:async payload=>{state.responseCalls++;return overrides.respond?overrides.respond(payload,state):'Considere duas alternativas e seus efeitos.'},agentPrompts:Object.fromEntries(['MNT','CTN','PRF','IMP','FBK','OTO','CRS'].map(k=>[k,'Prompt consolidado '+k]))});
 return {state,service};
}
test('Contexto é preservado quando muda a necessidade funcional',async()=>{
 const {state,service}=fixture({classify:async p=>p.messages.length>1?{...analysis,job:'prepare_message',decisionSufficientlyClear:true}:analysis});
 await service.turn(scope,input);const r=await service.turn(scope,{...input,requestId:'test-request-002',content:'Agora preciso organizar a mensagem.'});
 assert.equal(r.route.agent,'FBK');assert.equal(r.route.transition,true);assert.equal(state.session.context.messages.length,4);assert.equal(state.session.context.messages[0].content,input.content);
});
test('Resposta com não não é automaticamente frustração/Contenção',async()=>{
 const {service}=fixture();await service.turn(scope,input);const r=await service.turn(scope,{...input,requestId:'test-request-002',content:'Não escolhi o caminho ainda.'});assert.equal(r.route.agent,'MNT');
});
test('Ambiguidade faz uma pergunta e dispensa geração de resposta especializada',async()=>{
 const {service,state}=fixture({classify:async()=>({...analysis,confidence:'low'})});const r=await service.turn(scope,input);assert.equal(r.route.mode,'clarify');assert.equal(state.responseCalls,0);assert.match(r.text,/\?$/);
});
test('Falha do serviço de IA não fabrica agente nem grava sucesso',async()=>{
 const {service,state}=fixture({classify:async()=>{throw new Error('synthetic-provider-401')}});await assert.rejects(service.turn(scope,input),e=>e.code==='MODEL_UNAVAILABLE'&&e.status===503);assert.equal(state.commits.length,0);assert.equal(state.responseCalls,0);
});
test('Resposta de classificação inválida não vira Mentor',async()=>{
 const {service,state}=fixture({classify:async()=>'{malformed'});await assert.rejects(service.turn(scope,input),e=>e.code==='INVALID_MODEL_RESPONSE');assert.equal(state.commits.length,0);
});
test('Mesmo requestId não duplica mensagem, contagem ou chamada de IA',async()=>{
 const {service,state}=fixture();const first=await service.turn(scope,input);const second=await service.turn(scope,input);assert.equal(second.replayed,true);assert.equal(second.text,first.text);assert.equal(state.session.exchangeCount,1);assert.equal(state.classifyCalls,1);
});
test('Mesmo requestId com outro conteúdo é conflito',async()=>{
 const {service}=fixture();await service.turn(scope,input);await assert.rejects(service.turn(scope,{...input,content:'Outro conteúdo.'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
});
test('Requisição de outra pessoa ou empresa não acessa a sessão',async()=>{
 const {service,state}=fixture();await assert.rejects(service.turn({...scope,userId:'other'},input),e=>e.code==='SESSION_NOT_FOUND');await assert.rejects(service.turn({...scope,organizationId:'other'},input),e=>e.code==='SESSION_NOT_FOUND');assert.equal(state.privateReads,0);assert.equal(state.classifyCalls,0);
});
test('Sem opção habilitada o histórico privado não é recuperado',async()=>{
 const {service,state}=fixture();await service.turn(scope,input);assert.equal(state.privateReads,0);assert.equal(state.commits[0].privateRecord,null);
});
test('Opção habilitada exige aviso reconhecido',async()=>{
 const {service,state}=fixture();state.settings.enabled=true;state.settings.noticeVersion='wrong-version';await service.turn(scope,input);assert.equal(state.privateReads,0);assert.equal(state.commits[0].privateRecord,null);
});
test('Histórico privado habilitado é usado sem virar autorização do modelo',async()=>{
 const {service,state}=fixture({classify:async()=>({...analysis,historyAuthorized:true,historyCorroborated:true})});state.settings={enabled:true,noticeVersion:NOTICE_VERSION,revision:'1'};state.history=[{input:'Situação fictícia anterior.'}];const r=await service.turn(scope,input);assert.equal(r.historyUsed,true);assert.equal(r.route.agent,'MNT');assert.ok(state.commits[0].privateRecord);
});
test('Desativar ou apagar durante a geração impede regravação',async()=>{
 const {service,state}=fixture({respond:async(_p,s)=>{s.settings.revision='1';return 'Resposta fictícia.'}});await assert.rejects(service.turn(scope,input),e=>e.code==='CONVERSATION_CHANGED');assert.equal(state.session.exchangeCount,0);
});
test('Fechamento com histórico desativado remove texto do contexto persistido',async()=>{
 const {service,state}=fixture({respond:async()=> 'Agora há clareza. [ENCERRAR]'});const r=await service.turn(scope,input);assert.equal(r.status,'closed');assert.equal(r.text.includes('[ENCERRAR]'),false);assert.equal(JSON.stringify(state.session.context).includes(input.content),false);assert.equal(state.commits[0].privateRecord,null);
});
test('Fechamento com histórico habilitado preserva contexto privado',async()=>{
 const {service,state}=fixture({respond:async()=> 'Agora há clareza. [ENCERRAR]'});state.settings={enabled:true,noticeVersion:NOTICE_VERSION,revision:'1'};await service.turn(scope,input);assert.equal(state.session.context.messages.length,2);assert.ok(state.commits[0].privateRecord);
});
test('Mensagem acima do limite não chama modelo',async()=>{
 const {service,state}=fixture();await assert.rejects(service.turn(scope,{...input,content:'x'.repeat(8001)}),e=>e.code==='INVALID_INPUT');assert.equal(state.classifyCalls,0);
});
test('Geração concorrente da mesma sessão é recusada e bloqueio é liberado',async()=>{
 let release;const waiting=new Promise(resolve=>{release=resolve});const {service,state}=fixture({classify:async()=>{await waiting;return analysis}});
 const first=service.turn(scope,input);await new Promise(resolve=>setImmediate(resolve));await assert.rejects(service.turn(scope,{...input,requestId:'test-request-002'}),e=>e.code==='TURN_IN_PROGRESS');release();await first;assert.equal(state.session.exchangeCount,1);
 await service.turn(scope,{...input,requestId:'test-request-003'});assert.equal(state.session.exchangeCount,2);
});
