'use strict';
// Structured synthetic observations, never semantic approval of an AI response.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {decideRoute,readSituation,ROUTING_VERSION,SITUATION_STATES}=require('./functional-policy.cjs');
const {createConversationService,readAnalysis}=require('./conversation-service.cjs');
const {validateProgress,closingFallback}=require('./conversation-guidance.cjs');
const contract=require('./agent-contract.json');
const profile=contract.agents.find(a=>a.id==='OTO');
const base={scope:'leadership',job:'conduct_live',confidence:'high',conversationInProgress:true};
const scope={userId:'fictional-user',organizationId:'fictional-company'};
function fixture(classify=async()=>base,respond=async()=> 'Uma fala curta, restrita ao momento relatado.') {
 const state={session:{status:'active',exchangeCount:0,context:{}},responses:[],commits:[]};
 const repository={
  getSession:async s=>s.userId===scope.userId&&s.organizationId===scope.organizationId?state.session:null,
  getHistorySettings:async()=>({enabled:false,noticeVersion:null,revision:'fictional'}),
  readPrivateHistory:async()=>{throw Error('PRIVATE_HISTORY_NOT_ALLOWED')},
  commitTurn:async(s,t)=>{assert.deepEqual(s,scope);state.commits.push(t);state.session={...state.session,context:t.context,exchangeCount:t.nextCount,status:t.status};return true},
 };
 const service=createConversationService({repository,classify,respond:async p=>{state.responses.push(p);return respond(p)},agentPrompts:Object.fromEntries(contract.agents.map(a=>[a.id,a.prompt]))});
 const turn=(content,n=1)=>service.turn(scope,{sessionId:'fictional-session',requestId:'fictional-turn-'+n,content});
 return {state,turn};
}
for(const [name,content] of [
 ['abertura','A reunião começou agora; preciso abrir a conversa.'],
 ['tensão documental','Estou numa reunião e estão questionando minha decisão. Estou começando a ceder.'],
 ['retomada em grupo','A equipe está falando ao mesmo tempo; preciso retomar o foco agora.'],
 ['fechamento ao vivo','Estamos terminando a conversa e preciso organizar o fechamento.'],
]){
 test(name+' seleciona 1:1 sem compromisso-alvo',async()=>{
  const {state,turn}=fixture(async()=>({...base,situationState:'DURING',stateEvidence:content}));
  const r=await turn(content);
  assert.equal(r.route.agent,'OTO');assert.equal(r.exchangeCount,1);
  assert.equal(state.session.context.situationReading.state,'DURING');
  assert.match(state.responses[0].system,/Não exija compromisso-alvo/);
  assert.equal(state.responses[0].system.includes('fechamento bilateral'),false);
 });
}
test('Nome de reunião e Durante não selecionam 1:1 sem necessidade de condução',()=>{
 assert.equal(decideRoute({...base,job:'unclear',situationState:'DURING'}).mode,'clarify');
 assert.equal(decideRoute({...base,job:'compare_paths',situationState:'DURING'}).agent,'MNT');
});
test('Condução marcada sem conversa em curso pede contexto, não compromisso',()=>{
 const r=decideRoute({...base,conversationInProgress:false});
 assert.equal(r.agent,null);assert.equal(r.reason,'live_context_missing');assert.doesNotMatch(r.question,/compromisso|bilateral/);
});
for(const [job,agent,extra] of [
 ['prepare_message','FBK',{decisionSufficientlyClear:true,conversationInProgress:false,situationState:'BEFORE'}],
 ['compare_paths','MNT',{}],['understand_impact','IMP',{}],
]){
 test('Fronteira '+job+' não é capturada por 1:1',()=>assert.equal(decideRoute({...base,job,...extra}).agent,agent));
}
test('Risco imediato precede condução ao vivo',()=>{
 const threat='Uma pessoa está ameaçando agredir a equipe agora.';
 const analysis={...base,immediateExternalRisk:true,riskKind:'physical',
  riskBasis:'concrete_immediate_threat_or_harm',riskEvidence:threat,riskImpactEvidence:threat,ownClarityImpaired:true};
 const context={reportedMessages:[{role:'user',content:threat}]};
 assert.equal(decideRoute(analysis,context).agent,'CRS');
 assert.equal(decideRoute({...analysis,riskImpactEvidence:''},context).agent,'OTO');
 assert.equal(decideRoute(analysis,{reportedMessages:[{role:'assistant',content:threat}]}).agent,'OTO');
});
test('Emergência pessoal mantém apoio humano',()=>assert.equal(decideRoute({...base,personalEmergency:true}).mode,'human_support'));
for(const state of SITUATION_STATES){
 test('Leitura '+state+' é interna e não determina agente',async()=>{
  const content='Relato fictício para validar apenas o transporte da leitura.';
  const {state:s,turn}=fixture(async()=>({...base,job:'compare_paths',situationState:state,stateEvidence:content}));
  const r=await turn(content);
  assert.equal(r.route.agent,'MNT');assert.equal(s.session.context.situationReading.state,state);
  assert.equal(Object.hasOwn(r,'situationReading'),false);
  assert.equal(s.responses[0].turn.situationReading.state,state);
 });
}
test('Vazio não implica incapacidade emocional',()=>assert.equal(decideRoute({...base,job:'unclear',situationState:'EMPTY',ownClarityImpaired:false}).mode,'clarify'));
test('Ausência de base ou citação inventada não produz estado',()=>{
 assert.equal(readSituation({situationState:'DURING',stateEvidence:'inventado'},[{role:'user',content:'outro relato'}]).state,null);
 assert.equal(readSituation({situationState:'DURING'}).state,null);
 assert.equal(readSituation({situationState:null,stateEvidence:''}).state,null);
 assert.equal(readSituation({situationState:'DURING',stateEvidence:'relato'},[{role:'assistant',content:'relato'}]).state,null);
});
test('Estado inválido é rejeitado, não inventado',()=>assert.throws(()=>readAnalysis({...base,situationState:'DIAGNOSTICO'}),TypeError));
test('Correção do contexto atualiza estado e agente sem reiniciar contagem',async()=>{
 const {state,turn}=fixture(async p=>p.messages.length===1
  ?{...base,situationState:'DURING',stateEvidence:'A conversa está acontecendo.'}
  :{...base,job:'prepare_message',conversationInProgress:false,decisionSufficientlyClear:true,situationState:'BEFORE',stateEvidence:'Corrigindo: a conversa será amanhã.'});
 await turn('A conversa está acontecendo.');
 const r=await turn('Corrigindo: a conversa será amanhã.',2);
 assert.equal(r.route.agent,'FBK');assert.equal(r.route.transition,true);assert.equal(r.exchangeCount,2);
 assert.equal(state.session.context.situationReading.state,'BEFORE');
 assert.equal(state.session.context.messages[0].content,'A conversa está acontecendo.');
});
test('Sem base nova suficiente não herda estado antigo',async()=>{
 const {state,turn}=fixture(async p=>p.messages.length===1?{...base,situationState:'DURING',stateEvidence:'Agora ao vivo.'}:{...base,situationState:null,stateEvidence:''});
 await turn('Agora ao vivo.');await turn('Não tenho base para essa leitura.',2);
 assert.equal(state.session.context.situationReading.state,null);
});
test('Transições preservam dez trocas globais e recusam décima primeira',async()=>{
 const {state,turn}=fixture(async p=>p.messages.length<17?base:{...base,job:'compare_paths'},
  async p=>p.turn.number===10?'Síntese fictícia: a condução foi organizada, mas os efeitos não foram relatados. Próximo passo: verificar o que ocorreu sem presumir execução.':'Ainda há uma lacuna no momento relatado.');
 for(let n=1;n<=10;n++){const r=await turn('Relato fictício '+n,n);assert.equal(r.exchangeCount,n);assert.equal(r.status,n===10?'closed':'active');}
 assert.equal(state.session.context.routingVersion,ROUTING_VERSION);
 await assert.rejects(turn('Outra troca',11),e=>e.code==='SESSION_CLOSED');
 assert.equal(state.responses.length,10);
});
test('Fechamento antecipado requer próximo passo com evidência, não compromisso',async()=>{
 const content='Posso pedir que retomemos o ponto que estávamos discutindo.';
 const completed=[{criterion:'OTO.next',evidence:[{message:0,quote:content}]}];
 const payload={text:'Há um próximo movimento possível.',stage:'close',completed,pending:profile.diagnostic_criteria.filter(c=>c.id!=='OTO.next').map(c=>c.id),lenses:[],closingSummary:'Você identificou como retomar a conversa; a reação do grupo ainda não foi relatada.',nextStep:'A retomada do ponto discutido é o movimento que você considera; a reação permanece em aberto.',authorship:{supportMode:'explore',approachEvidence:[],examplePurpose:''}};
 const {turn}=fixture(undefined,async p=>validateProgress(payload,profile,p.messages,p.turn));
 const r=await turn(content);assert.equal(r.status,'closed');assert.equal(r.exchangeCount,1);assert.match(r.text,/ainda não foi relatada/);
 // Pending criteria alone are not absence of clarity or of reported evidence.
 const messages=[{role:'user',content}];
 assert.equal(validateProgress({...payload,completed:[],pending:profile.diagnostic_criteria.map(c=>c.id)},profile,messages,{number:1}).progress.stage,'close');
 assert.throws(()=>validateProgress({...payload,nextStep:''},profile,messages,{number:1}),/INVALID_CLOSURE/);
 assert.throws(()=>validateProgress({...payload,completed:[{criterion:'OTO.next',evidence:[{message:0,quote:'Eu já executei e resolveu.'}]}]},profile,messages,{number:1}),/INVALID_PROGRESS_EVIDENCE/);
 assert.throws(()=>validateProgress({...payload,authorship:undefined},profile,messages,{number:1}),/AUTONOMY_CONSTRAINT_FAILED/);
});
test('Recuperação final de 1:1 não exige compromisso nem inventa execução',()=>{
 const text=closingFallback('OTO',[{role:'user',content:'Estou tentando retomar o foco.'}]);
 assert.doesNotMatch(text,/compromisso|bilateral/);assert.match(text,/lacunas/);assert.equal(text.includes('?'),false);
});
test('Contrato preserva definições de origem e remove apenas a restrição prescrita',()=>{
 const original=require(path.resolve('prioris-routing-consolidation-20261012/agent_contract.json')).agents.find(a=>a.id==='OTO');
 assert.deepEqual(profile.source_definition,original.source_definition);
 assert.deepEqual(profile.determinations,original.determinations);
 assert.deepEqual(profile.allowed_transversal_lenses,original.allowed_transversal_lenses);
 assert.equal(profile.diagnostic_criteria.some(c=>c.id==='OTO.target'),false);
 assert.match(profile.prompt,/bilateral ou em grupo/);assert.match(profile.prompt,/Não exija compromisso-alvo/);
});
test('Router continua opt-in e camada Evolução não é acionada',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../routes/functional-orchestrator.ts'),'utf8');
 assert.match(source,/process\.env\.PRIORIS_FUNCTIONAL_ROUTING_V1\s*===\s*["']true["']/);
 const trusted={userId:'f',organizationId:'f',memoryOwnerId:'f',memoryOrganizationId:'f',historyAuthorized:true,historyCorroborated:true,historyCompatibleWithCurrent:true};
 assert.deepEqual(decideRoute(base,trusted).background,[]);
});
