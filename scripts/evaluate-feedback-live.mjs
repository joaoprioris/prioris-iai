import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const require=createRequire(import.meta.url);
const apiRequire=createRequire(new URL('../artifacts/api-server/package.json',import.meta.url));
const {feedbackEvaluationCases}=require('../artifacts/api-server/src/lib/feedback-evaluation-cases.cjs');
const {feedbackReferenceInventory,resolveContract}=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const root=fileURLToPath(new URL('../',import.meta.url));
const allCases=feedbackEvaluationCases();
const output=entry=>console.log(JSON.stringify(entry));
if(process.argv.includes('--list')){
 output({inventory:feedbackReferenceInventory(),covered:allCases.map(({id,origin,references,userTurns})=>({id,origin,references,turns:userTurns.length})),pipeline:'production service + classification + response; in-memory repository; no HTTP/login/PostgreSQL/SED validation'});
 process.exit(0);
}
const at=process.argv.indexOf('--scenario');
if(at<0||!allCases.some(s=>s.id===process.argv[at+1]))throw Error('SELECT_ONE_SCENARIO_WITH_--scenario');
const scenario=allCases.find(s=>s.id===process.argv[at+1]);
if(!process.env.ANTHROPIC_API_KEY&&!process.argv.includes('--check-pipeline'))throw Error('ANTHROPIC_API_KEY_REQUIRED');
if(process.env.PRIORIS_AI_PROVIDER!=='anthropic')throw Error('DIRECT_ANTHROPIC_REQUIRED');
const statePath=process.env.IAI_EVAL_STATE||resolve(root,'../api-budget.json');
const cap=Number(process.env.IAI_EVAL_MAX_USD||1);
if(!(cap>0&&cap<=1))throw Error('INVALID_EVALUATION_CAP');
const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{};
const save=()=>writeFileSync(statePath,JSON.stringify(state,null,2));
const budget=createPilotBudget(state,save);
state.cap=Math.floor(cap*1e6);
if(state.calls?.some(c=>c.status!=='accounted'))throw Error('UNCONFIRMED_USAGE_REQUIRES_REVIEW');
state.blocked=false;state.blockReason=null;save();
const redact=value=>String(value).replace(/sk-ant-[A-Za-z0-9_-]+/g,'[REDACTED]');
// Reuse the exact app providers, including their prompts, validation and repair.
// Storage is isolated; no connection is made to the placeholder PostgreSQL URL.
process.env.DATABASE_URL='postgresql://127.0.0.1:1/unused';
const {build}=apiRequire('esbuild');
const compiled=resolve(root,'artifacts/api-server/dist/evaluation-provider.cjs');
mkdirSync(dirname(compiled),{recursive:true});
const fingerprint=createHash('sha256');
for(const base of ['artifacts/api-server/src','lib/db/src']){for(const name of readdirSync(resolve(root,base),{recursive:true}).sort()){if(/\.(?:ts|cjs|json)$/.test(name))fingerprint.update(base+'/'+name).update(readFileSync(resolve(root,base,name)));}}
const sourceHash=fingerprint.digest('hex');
const stamp=compiled+'.sha256';
if(!existsSync(compiled)||!existsSync(stamp)||readFileSync(stamp,'utf8')!==sourceHash)await build({entryPoints:[resolve(root,'artifacts/api-server/src/routes/functional-orchestrator.ts')],outfile:compiled,bundle:true,platform:'node',format:'cjs',external:['pg-native'],alias:{'@workspace/db':resolve(root,'lib/db/src/index.ts')},logLevel:'silent'});
writeFileSync(stamp,sourceHash);
const {createModelProviders}=apiRequire(compiled);
const Anthropic=apiRequire('@anthropic-ai/sdk').default;
const rawClient=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY||'offline-pipeline-check',maxRetries:0,timeout:30000});
let activeTurn=0,calls=0,lastGeneration=null,lastValidation=null,session;
const client={messages:{create:async payload=>{
 const call=++calls;
 output({event:'call_start',turn:activeTurn,call,model:payload.model,max_tokens:payload.max_tokens});
 try{
  const reply=await budget.call(payload,p=>rawClient.messages.create(p));
  output({event:'usage',turn:activeTurn,call,model:payload.model,usage:reply.usage,budget:budget.snapshot()});
  return reply;
 }catch(error){output({event:'call_stopped',turn:activeTurn,call,error:redact(error.message),budget:budget.snapshot()});throw error;}
}}};
const providers=createModelProviders({client,
 onGenerationObservation:entry=>{lastGeneration=entry;output({event:'generation',turn:activeTurn,attempt:entry.attempt,agent:entry.agent,text:entry.input?.text,delivery:entry.input?.delivery,stage:entry.input?.stage});},
 onValidationObservation:entry=>{lastValidation=entry;output({event:'validation',turn:activeTurn,attempt:entry.attempt,phase:entry.phase,code:entry.code});},
});
const contract=resolveContract(require('../artifacts/api-server/src/lib/agent-contract.json'));
const repository={
 getSession:async()=>structuredClone(session),
 getHistorySettings:async()=>({enabled:false,noticeVersion:null,revision:1}),
 readPrivateHistory:async()=>[],
 recordObservation:async(_scope,e)=>output({event:'routing',turn:activeTurn,route:e.route,functionalNeed:e.functionalNeed}),
 recordFailure:async(_scope,e)=>output({event:'failure',turn:activeTurn,code:e.code}),
 commitTurn:async(_scope,e)=>{if(session.exchangeCount!==e.expectedCount)return false;session={...session,status:e.status,exchangeCount:e.nextCount,context:e.context};return true;},
};
const service=createConversationService({repository,...providers,agentPrompts:Object.fromEntries(contract.agents.filter(a=>a.mode==='conversacional').map(a=>[a.id,a.prompt]))});
session={status:'active',exchangeCount:0,context:{}};
if(process.argv.includes('--check-pipeline')){output({event:'pipeline_ready',modelCalls:0,provider:'actual createModelProviders',service:'actual createConversationService'});process.exit(0);}
let passed=true,lastText='';
output({event:'start',scenario:scenario.id,origin:scenario.origin,references:scenario.references,sourceHead:'79b0a57b7359b8a90324988bf7d444fd2e79d694',pipeline:'production service + providers; isolated memory storage',capUSD:cap});
for(let index=0;index<scenario.userTurns.length;index++){
 activeTurn=index+1;lastGeneration=null;lastValidation=null;
 let content=scenario.userTurns[index];
 // Do not accuse the model of a fabrication it did not make.
 if(index===2&&scenario.id==='fbk-peer-interruption-correction'&&!/dificult\w*[^.!?]*(?:concluir|raciocínio)/iu.test(lastText))content='Quero manter a fala só nas duas interrupções, sem supor o impacto. Pode deixar a abertura mais natural, sem tom de acusação?';
 if(index===2&&scenario.id==='fbk-peer-deliveries-causality'&&!/(?:mudança|formato)[^.!?]*(?:causou|provocou|gerou)[^.!?]*atraso/iu.test(lastText))content='Quero reconhecer que mudei o formato, sem afirmar que isso causou o atraso. Pode ajustar a abertura nesse sentido?';
 output({event:'user',turn:activeTurn,text:content,adapted:content!==scenario.userTurns[index]});
 try{
  const result=await service.turn({userId:'synthetic-owner',organizationId:'synthetic-org'},{sessionId:scenario.id,requestId:`eval-${Date.now()}-${index}`,content});
  lastText=result.text;
  const flags=[];
  if(index<scenario.userTurns.length-1&&result.status==='closed')flags.push('PREMATURE_CLOSE');
  if(index===scenario.userTurns.length-1&&result.status!=='closed')flags.push('EXPLICIT_CLOSE_IGNORED');
  if(lastValidation?.code&&lastValidation.code!=='ACCEPTED')flags.push('RECOVERY_NOT_MODEL_SUCCESS');
  if(/^(?:Leitura(?: do momento)?|Tensão(?: central)?|Direcionamento(?: prático)?):?/imu.test(result.text))flags.push('MECHANICAL_HEADINGS');
  output({event:'assistant',turn:activeTurn,text:result.text,status:result.status,route:result.route,flags});
  if(flags.length){passed=false;break;}
 }catch(error){passed=false;output({event:'turn_stopped',turn:activeTurn,error:redact(error.message),validation:lastValidation?.code,generationStage:lastGeneration?.input?.stage});break;}
}
output({event:'summary',scenario:scenario.id,completed:passed,modelCalls:calls,budget:budget.snapshot(),acceptance:'requires human review of the transcript; no claim of HTTP/login/database/SED validation'});
process.exitCode=passed?0:1;
