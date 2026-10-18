'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {validateMethodologicalFidelity}=require('../artifacts/api-server/src/lib/methodological-fidelity.cjs');
const {createConversationService,ConversationError}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {responseInstructions}=require('../artifacts/api-server/src/lib/conversation-instructions.cjs');
const {feedbackOperationalScope}=require('../artifacts/api-server/src/lib/feedback-scope.cjs');
const {extractAnthropicContent}=require('../artifacts/api-server/src/lib/anthropic-content.cjs');
const {feedbackReferenceInventory}=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
const {feedbackEvaluationCases}=require('../artifacts/api-server/src/lib/feedback-evaluation-cases.cjs');
const contract=require('../artifacts/api-server/src/lib/agent-contract.json');
const profile=contract.agents.find(a=>a.id==='FBK');
const criteria=profile.diagnostic_criteria.map(c=>c.id);
const shape=(text,operationalClaims=[])=>({text,stage:'explore',completed:[],pending:criteria,lenses:[],closingSummary:'',nextStep:'',delivery:null,operationalClaims,authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''}});

test('Resposta real duplicada conserva fatos e apresenta o exemplo uma unica vez',()=>{
 const fact='Na reunião de ontem, ela me interrompeu duas vezes enquanto eu explicava uma proposta.';
 const request='Pode me dar uma abertura curta e adaptável?';
 const example='Ontem, quando apresentei a proposta, você me interrompeu duas vezes. Quero entender o que aconteceu e combinar como organizamos nossas conversas nas reuniões.';
 const candidate={...shape('Aqui está uma abertura:\n\n"'+example+'"\n\nVocê pode ajustar o tom conforme o contexto.'),delivery:{kind:'message',text:example},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:1,quote:request}],basisEvidence:[{message:0,quote:fact}],examplePurpose:'Oferecer uma abertura breve baseada no relato.'}};
 const result=validateProgress(candidate,profile,[{role:'user',content:fact},{role:'user',content:request}],{number:2});
 assert.equal(result.text.split(example).length-1,1);
 assert.match(result.text,/Você pode ajustar o tom/);
 assert.ok(result.progress.displayNormalizations.some(n=>n.kind==='delivery_moved_to_separate_field'));
 assert.equal(result.progress.authorship.basisEvidence[0].quote,fact);
});

test('Separar exemplo identico nao dispensa base factual',()=>{
 const text='Quero entender o que aconteceu.';
 const candidate={...shape('Uma opção: "'+text+'"'),delivery:{kind:'message',text},authorship:{supportMode:'optional_example',approachEvidence:[],requestEvidence:[{message:0,quote:'Pode me dar uma abertura?'}],examplePurpose:'Oferecer uma abertura breve.'}};
 assert.throws(()=>validateProgress(candidate,profile,[{role:'user',content:'Pode me dar uma abertura?'}],{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});

test('Apresentei na voz do assistente ainda exige historico proprio',()=>{
 const candidate=shape('Eu apresentei uma abertura antes.');
 assert.throws(()=>validateProgress(candidate,profile,[{role:'user',content:'Quero preparar uma conversa.'}],{number:1}),/UNSUPPORTED_FACT/);
});

test('Caminho real carrega um único escopo operacional derivado do Feedback canônico',()=>{
 const scope=feedbackOperationalScope();
 assert.equal(scope.canonical.id,'FBK');
 assert.equal(scope.canonical.purpose,profile.purpose);
 const prompt=responseInstructions('FBK');
 assert.equal(prompt.split('ESCOPO OPERACIONAL DE FEEDBACK').length-1,1);
 assert.match(prompt,/abandonar a leitura corrigida, sem defendê-la/);
 assert.match(prompt,/cronograma, orçamento/);
 assert.doesNotMatch(responseInstructions('OTO'),/ESCOPO OPERACIONAL DE FEEDBACK/);
});

test('Inventário distingue apoio canônico de casos completos de avaliação e preserva refs',()=>{
 const inventory=feedbackReferenceInventory(),cases=feedbackEvaluationCases();
 assert.equal(inventory.supportExamples.length,1);
 assert.equal(inventory.supportExamples[0].id,'S05:example:P0066-P0073');
 assert.equal(inventory.evaluationCases.length,90);
 assert.equal(cases.length,4);
 for(const item of cases){
  assert.equal(item.purpose,'evaluation_case');
  assert.ok(item.origin.length>10);
  assert.ok(item.userTurns.length>=3);
  assert.ok(item.references.every(ref=>inventory.evaluationCases.some(candidate=>candidate.id===ref.ref&&candidate.source===ref.source)));
 }
});

test('Adaptador descarta thinking privado, aceita terminais pertinentes e recusa formatos inesperados',()=>{
 const textReply={content:[{type:'thinking',thinking:'privado'},{type:'redacted_thinking',data:'privado'},{type:'text',text:'Resposta pública.'}]};
 assert.deepEqual(extractAnthropicContent(textReply,{mode:'text'}),{text:'Resposta pública.',privateBlocksDiscarded:2});
 const toolReply={content:[{type:'thinking',thinking:'privado'},{type:'tool_use',name:'registrar_resposta',input:{text:'ok'}}]};
 assert.deepEqual(extractAnthropicContent(toolReply,{mode:'tool',toolName:'registrar_resposta'}),{input:{text:'ok'},privateBlocksDiscarded:1});
 assert.throws(()=>extractAnthropicContent({content:[{type:'tool_use',name:'x',input:{}}]},{mode:'text'}),/UNEXPECTED_CONTENT/);
 assert.throws(()=>extractAnthropicContent({content:[{type:'text',text:'fora do contrato'}]},{mode:'tool',toolName:'registrar_resposta'}),/UNEXPECTED_CONTENT/);
});

test('Regressão completa de interrupções preserva fatos, correção, abertura e encerramento',()=>{
 const initial='Quero preparar um feedback para uma pessoa da equipe. Na reunião de ontem, ela me interrompeu duas vezes enquanto eu explicava uma proposta. Quero ouvir o que aconteceu e combinar como vamos conversar nas próximas reuniões.';
 const request='Pode me dar uma abertura curta e adaptável?';
 const opening='Na reunião de ontem, você me interrompeu duas vezes enquanto eu explicava uma proposta. Quero ouvir o que aconteceu e combinar como vamos conversar nas próximas reuniões.';
 const messages=[{role:'user',content:initial},{role:'assistant',content:'Vamos organizar a abordagem.'},{role:'user',content:request}];
 const opened=validateProgress({...shape('Uma opção breve e adaptável ao seu tom:'),delivery:{kind:'message',text:opening},authorship:{supportMode:'optional_example',requestIntent:'brief_adaptable_example',approachEvidence:[],requestEvidence:[{message:1,quote:request}],basisEvidence:[{message:0,quote:'Na reunião de ontem, ela me interrompeu duas vezes enquanto eu explicava uma proposta.'},{message:0,quote:'Quero ouvir o que aconteceu e combinar como vamos conversar nas próximas reuniões.'}],examplePurpose:'Oferecer uma abertura breve para adaptação pelo líder.'}},profile,messages,{number:2});
 assert.doesNotMatch(opened.text,/cronograma|orçamento|dificultou.*raciocínio/i);
 messages.push({role:'assistant',content:opened.text},{role:'user',content:'Correção: eu não disse que as interrupções dificultaram concluir meu raciocínio. Esse impacto foi uma interpretação sua.'});
 const corrected=validateProgress(shape('Você tem razão na correção: as duas interrupções foram relatadas; o impacto sobre concluir seu raciocínio não foi. Retiro essa interpretação.'),profile,messages,{number:3});
 assert.doesNotMatch(corrected.text,/impacto objetivo|ainda assim|mas dificultou/i);
 messages.push({role:'assistant',content:corrected.text},{role:'user',content:'Pode encerrar por aqui.'});
 const closed=validateProgress({...shape('Encerramento.'),stage:'close',closingSummary:'Você organizou uma abertura baseada nas duas interrupções relatadas e retirou o impacto que não havia afirmado.',nextStep:'A abertura continua adaptável ao seu tom e preserva o convite para ouvir a outra pessoa.'},profile,messages,{number:4});
 assert.equal(closed.progress.stage,'close');
});

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
 assert.doesNotThrow(()=>validateMethodologicalFidelity(shape(faithful),[{role:'user',content:correction}],[faithful],'FBK'));
 assert.doesNotThrow(()=>validateProgress(shape(faithful),profile,[{role:'user',content:correction}],{number:1}));
 const claim={kind:'impact',role:'user',message:0,text:asserted,quote:denied};
 assert.throws(()=>validateMethodologicalFidelity(shape(asserted,[claim]),[{role:'user',content:denied}],[asserted],'FBK'),/UNSUPPORTED_FACT/);
 assert.throws(()=>validateProgress(shape(asserted,[claim]),profile,[{role:'user',content:denied}],{number:1}),/UNSUPPORTED_FACT/);
});

test('Negação de outro sujeito não muda a polaridade da causa afirmada',()=>{
 const asserted='Sua mudança de formato causou o atraso.';
 for(const source of ['Minha mudança de formato causou o atraso.','Não foi a equipe: minha mudança de formato causou o atraso.']){
  const quote='minha mudança de formato causou o atraso.';
  const exact=source.includes(quote)?quote:'Minha mudança de formato causou o atraso.';
  const claim={kind:'impact',role:'user',message:0,text:asserted,quote:exact};
  assert.doesNotThrow(()=>validateMethodologicalFidelity(shape(asserted,[claim]),[{role:'user',content:source}],[asserted],'FBK'));
  assert.doesNotThrow(()=>validateProgress(shape(asserted,[claim]),profile,[{role:'user',content:source}],{number:1}));
 }
 assert.throws(()=>validateProgress(shape('Não só causou o atraso, como gerou retrabalho.'),profile,[{role:'user',content:'A causa não foi confirmada.'}],{number:1}),/UNSUPPORTED_FACT/);
});

test('Hipótese causal identificada permanece permitida',()=>{
 const text='Uma hipótese é que a mudança causou o atraso.';
 assert.doesNotThrow(()=>validateMethodologicalFidelity(shape(text),[{role:'user',content:'Não sei o que causou o atraso.'}],[text],'FBK'));
 assert.doesNotThrow(()=>validateProgress(shape(text),profile,[{role:'user',content:'Não sei o que causou o atraso.'}],{number:1}));
});

test('Guard causal focal não altera as outras funções',()=>{
 const asserted='Sua mudança de formato causou o atraso.';
 assert.doesNotThrow(()=>validateMethodologicalFidelity(shape(asserted),[{role:'user',content:'A causa não foi confirmada.'}],[asserted]));
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
