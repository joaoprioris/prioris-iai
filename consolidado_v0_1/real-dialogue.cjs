'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
process.env.DATABASE_URL='postgres://synthetic:synthetic@127.0.0.1:1/synthetic';process.env.PRIORIS_AI_PROVIDER='anthropic';
require(path.resolve('artifacts/api-server/node_modules/esbuild')).buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',alias:{'@workspace/db':path.resolve('lib/db/src/index.ts')},outfile:path.join(__dirname,'dialogue-bundle.cjs')});
const {createModelProviders}=require('./dialogue-bundle.cjs'),{createConversationService}=require('./conversation-service.cjs'),contract=require('./agent_contract.json');
const inputs=[
 'Quero comparar contratar alguém de fora e promover alguém interno. Ainda não tenho custos nem evidências de capacidade; não escolha por mim.',
 'O problema é uma vaga de liderança de projeto. Preciso entregar em dois meses. Não sei quem está pronto; ainda quero explorar alternativas.',
 'A promoção é de alguém que conhece a operação. A contratação externa seria de uma pessoa ainda não identificada. Não presuma capacidade de nenhuma delas.',
 'A equipe tem quatro pessoas e há verba ainda não confirmada. Quero comparar riscos sem apresentar uma conclusão que os dados não sustentam.',
 'Não temos dados de custo nem um candidato externo. A pessoa interna nunca liderou esse projeto. Quero entender a diferença entre reversibilidade das opções.',
 'Corrigindo: a pessoa interna já liderou um projeto menor. Não estou dizendo que está pronta para este. Mantenha essa distinção.',
 'Tenho receio de perder continuidade, mas também de sobrecarregar quem for promovido. Não quero usar antifragilidade para justificar carga sem limite.',
 'Não confirmei orçamento e não defini a pessoa. Ainda preciso comparar o que seria necessário verificar antes de escolher.',
 'As lacunas continuam: capacidade para este projeto e orçamento. Organize o que já sabemos e o que falta, sem abrir novos ramos.',
 'Já decidi que não vou contratar nem promover nesta semana. Vou levantar orçamento e exemplos de capacidade. Agora quero comunicar essa decisão à equipe, sem inventar impacto ou punição.'
];
const report={version:'0.2.0',synthetic:true,persistence:'in-memory',method:'Sequential real-model conversation; early closure recorded, not forced past closed state',budgetCapUSD:1,estimatedUSD:0,turns:[],validationFailures:[],sourceHashes:{}};
for(const n of ['agent_contract.json','functional-orchestrator.ts','conversation-guidance.cjs','conversation-service.cjs'])report.sourceHashes[n]=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,n))).digest('hex');
const providers=createModelProviders({onValidationFailure:(reason,input)=>report.validationFailures.push({reason,input}),onUsage:(m,u)=>{const r=m==='haiku'?[1,5]:[3,15];report.estimatedUSD+=(u.input_tokens*r[0]+u.output_tokens*r[1])/1e6;}});
let session={id:'synthetic-dialogue',status:'active',exchangeCount:0,context:{}};
const repo={getSession:async()=>session,getHistorySettings:async()=>({enabled:false,noticeVersion:null,revision:'0'}),commitTurn:async(s,t)=>{if(t.expectedCount!==session.exchangeCount)return false;session={...session,context:t.context,exchangeCount:t.nextCount,status:t.status};return true}};
const service=createConversationService({repository:repo,...providers,agentPrompts:Object.fromEntries(contract.agents.filter(a=>a.mode==='conversacional').map(a=>[a.id,a.prompt]))});
const scope={userId:'synthetic-owner',organizationId:'synthetic-org'};
function save(){fs.writeFileSync(path.join(__dirname,'real-dialogue-result.json'),JSON.stringify(report,null,2))}
(async()=>{for(let n=0;n<inputs.length;n++){if(report.estimatedUSD+.08>report.budgetCapUSD){report.pending='budget_guard';break}try{const result=await service.turn(scope,{sessionId:session.id,requestId:'dialogue-request-'+n,content:inputs[n]});report.turns.push({input:inputs[n],result});save();if(result.status==='closed'){report.earlyClosure=n<9;break}}catch(e){report.errorCode=e.code??e.name;break}}report.completedExchanges=session.exchangeCount;report.closed=session.status==='closed';report.countInvariant=report.turns.every((t,n)=>t.result.exchangeCount===n+1);if(report.closed){try{await service.turn(scope,{sessionId:session.id,requestId:'dialogue-after-closure',content:'Continue esta conversa.'});report.extraTurnRejected=false}catch(e){report.extraTurnRejected=e.code==='SESSION_CLOSED'}}report.controlPass=!report.errorCode&&!report.pending&&report.closed&&report.countInvariant&&report.extraTurnRejected;report.semanticApproval=false;save();console.log(JSON.stringify({exchanges:report.completedExchanges,closed:report.closed,pass:report.controlPass,costUSD:report.estimatedUSD,error:report.errorCode}));process.exit(report.controlPass?0:1)})().catch(e=>{report.errorType=e.name;save();process.exit(1)});
