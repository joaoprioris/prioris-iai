'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {validateMethodologicalFidelity}=require('../artifacts/api-server/src/lib/methodological-fidelity.cjs');
const {createConversationService,ConversationError}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const contract=require('../artifacts/api-server/src/lib/agent-contract.json');
const profile=contract.agents.find(a=>a.id==='FBK');
const criteria=profile.diagnostic_criteria.map(c=>c.id);
const shape=(text,operationalClaims=[])=>({text,stage:'explore',completed:[],pending:criteria,lenses:[],closingSummary:'',nextStep:'',delivery:null,operationalClaims,authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''}});

test('Feedback completo aceita abertura direta, incorpora correção e encerra',()=>{
 const initial='Preciso dar feedback formal sobre um par. Em duas entregas, os dados chegaram depois do prazo e refiz a consolidação. Em uma delas, mudei o formato perto do prazo. Quero reconhecer minha parte e ouvir a leitura dele.';
 const request='Pode me dar uma abertura?';
 const correction='Correção: eu não disse que minha mudança causou o atraso; ela só aconteceu perto do prazo.';
 const opening='Quero conversar sobre duas entregas em que os dados chegaram depois do prazo. Em uma delas, também mudei o formato perto do prazo. Quero reconhecer minha parte e ouvir como você lê o que aconteceu.';
 const turns=[{role:'user',content:initial},{role:'assistant',content:'Vamos trabalhar a abertura.'},{role:'user',content:request}];
 const base={stage:'explore',completed:[],pending:criteria,lenses:[],closingSummary:'',nextStep:'',operationalClaims:[]};
 const opened=validateProgress({...base,text:'Uma opção curta e adaptável para você ajustar ao seu tom:',delivery:{kind:'message',text:opening},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:1,quote:request}],basisEvidence:[{message:0,quote:'Em duas entregas, os dados chegaram depois do prazo e refiz a consolidação.'},{message:0,quote:'Em uma delas, mudei o formato perto do prazo.'}],examplePurpose:'Oferecer uma abertura curta para adaptação pelo líder.'}},profile,turns,{number:2});
 assert.equal(opened.text.split(opening).length-1,1);
 turns.push({role:'assistant',content:opened.text},{role:'user',content:correction});
 const contradicted=shape('Sua mudança de formato causou parte do atraso. Vale reconhecer isso antes de ouvir a leitura dele.');
 assert.throws(()=>validateProgress(contradicted,profile,turns,{number:3}),/UNSUPPORTED_FACT/);
 const corrected=validateProgress(shape('Sua correção separa coincidência temporal de atribuição: a mudança de formato ocorreu perto do prazo; causa e contribuição continuam abertas.'),profile,turns,{number:3});
 turns.push({role:'assistant',content:corrected.text},{role:'user',content:'Pode encerrar por aqui.'});
 const closed=validateProgress({...base,text:'Encerramento.',stage:'close',closingSummary:'Você tem uma abertura curta que nomeia as duas entregas, reconhece a mudança de formato perto do prazo sem tratá-la como causa e convida a leitura do seu par.',nextStep:'O próximo passo fica com você: adaptar essa abertura ao seu tom, mantendo separadas a coincidência temporal e a atribuição de causa.',delivery:null,authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''}},profile,turns,{number:4});
 assert.equal(closed.progress.stage,'close');assert.doesNotMatch(closed.text,/\?/);
});

test('Abertura direta preserva negativa, pedido citado e limite de roteiro',()=>{
 const fact='Em duas entregas, os dados chegaram depois do prazo.';
 const opening='Quero conversar sobre as duas entregas e ouvir como você lê o que aconteceu.';
 const attempt=request=>validateProgress({text:'Uma opção curta para adaptar:',stage:'explore',completed:[],pending:criteria,lenses:[],closingSummary:'',nextStep:'',operationalClaims:[],delivery:{kind:'message',text:opening},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:1,quote:request}],basisEvidence:[{message:0,quote:fact}],examplePurpose:'Oferecer uma abertura breve para adaptação pelo líder.'}},profile,[{role:'user',content:fact},{role:'user',content:request}],{number:2});
 for(const request of ['Não quero uma abertura.','Ele perguntou se pode me dar uma abertura.','Pode me dar um roteiro completo?'])
  assert.throws(()=>attempt(request),/AUTONOMY_CONSTRAINT_FAILED/);
});

test('Negação causal fiel passa e fonte negada não sustenta causa afirmativa',()=>{
 const correction='Correção: eu não disse que minha mudança causou o atraso; ela só aconteceu perto do prazo.';
 const faithful='Você não disse que sua mudança de formato causou o atraso.';
 const denied='Minha mudança de formato não causou o atraso.';
 const asserted='Sua mudança de formato causou o atraso.';
 assert.doesNotThrow(()=>validateMethodologicalFidelity(shape(faithful),[{role:'user',content:correction}],[faithful]));
 assert.doesNotThrow(()=>validateProgress(shape(faithful),profile,[{role:'user',content:correction}],{number:1}));
 const claim={kind:'impact',role:'user',message:0,text:asserted,quote:denied};
 assert.throws(()=>validateMethodologicalFidelity(shape(asserted,[claim]),[{role:'user',content:denied}],[asserted]),/UNSUPPORTED_FACT/);
 assert.throws(()=>validateProgress(shape(asserted,[claim]),profile,[{role:'user',content:denied}],{number:1}),/UNSUPPORTED_FACT/);
});

test('Negação de outro sujeito não muda a polaridade da causa afirmada',()=>{
 const asserted='Sua mudança de formato causou o atraso.';
 for(const source of ['Minha mudança de formato causou o atraso.','Não foi a equipe: minha mudança de formato causou o atraso.']){
  const quote='minha mudança de formato causou o atraso.';
  const exact=source.includes(quote)?quote:'Minha mudança de formato causou o atraso.';
  const claim={kind:'impact',role:'user',message:0,text:asserted,quote:exact};
  assert.doesNotThrow(()=>validateMethodologicalFidelity(shape(asserted,[claim]),[{role:'user',content:source}],[asserted]));
  assert.doesNotThrow(()=>validateProgress(shape(asserted,[claim]),profile,[{role:'user',content:source}],{number:1}));
 }
 assert.throws(()=>validateProgress(shape('Não só causou o atraso, como gerou retrabalho.'),profile,[{role:'user',content:'A causa não foi confirmada.'}],{number:1}),/UNSUPPORTED_FACT/);
});

test('Hipótese causal identificada permanece permitida',()=>{
 const text='Uma hipótese é que a mudança causou o atraso.';
 assert.doesNotThrow(()=>validateMethodologicalFidelity(shape(text),[{role:'user',content:'Não sei o que causou o atraso.'}],[text]));
 assert.doesNotThrow(()=>validateProgress(shape(text),profile,[{role:'user',content:'Não sei o que causou o atraso.'}],{number:1}));
});



test('Ambiguidade recebe ajuda concreta sem liberar exemplo por inferência',()=>{
 const message='Preciso conversar com um par sobre duas entregas, mas ainda não sei por onde começar.';
 const result=validateProgress(shape('Há dois planos distintos: relatar os atrasos observados e reconhecer sua mudança de formato sem transformá-la em causa. A lacuna é como você quer convidar a leitura dele.'),profile,[{role:'user',content:message}],{number:1});
 assert.match(result.text,/dois planos distintos/);
 const attempted={...shape('Uma opção:'),delivery:{kind:'message',text:'Quero conversar sobre as entregas.'},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:0,quote:message}],basisEvidence:[{message:0,quote:'duas entregas'}],examplePurpose:'Oferecer uma abertura breve para adaptação.'}};
 assert.throws(()=>validateProgress(attempted,profile,[{role:'user',content:message}],{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});

test('Falha do provider encerra a tentativa sem commit nem fallback',async()=>{
 const content='Preciso preparar um feedback formal sobre um par.';
 let committed=false,recordedFailure=null;
 const repository={
  getSession:async()=>({status:'active',exchangeCount:0,context:{}}),
  getHistorySettings:async()=>({enabled:false,noticeVersion:null,revision:1}),
  readPrivateHistory:async()=>[],
  commitTurn:async()=>{committed=true;return true;},
  recordFailure:async(_scope,event)=>{recordedFailure=event.code;},
 };
 const classify=async()=>({scope:'leadership',job:'prepare_message',confidence:'high',personalEmergency:false,immediateExternalRisk:false,ownClarityImpaired:false,conversationInProgress:false,decisionSufficientlyClear:true,substantiveDecisionPending:false,ownRecurrenceReported:false,situationState:'BEFORE',stateEvidence:content,needEvidence:[{message:0,quote:content}]});
 const respond=async()=>{throw Error('provider unavailable');};
 const service=createConversationService({repository,classify,respond,agentPrompts:{FBK:'Feedback canônico.'}});
 await assert.rejects(
  service.turn({userId:'fictional-user',organizationId:'fictional-org'},{sessionId:'fictional-session',requestId:'fictional-request-1',content}),
  error=>error instanceof ConversationError&&error.code==='MODEL_UNAVAILABLE'&&error.status===503,
 );
 assert.equal(committed,false);
 assert.equal(recordedFailure,'MODEL_UNAVAILABLE');
});
