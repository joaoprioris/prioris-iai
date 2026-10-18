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
const {PRICES}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const root=fileURLToPath(new URL('../',import.meta.url));
const allCases=feedbackEvaluationCases();
const output=entry=>console.log(JSON.stringify(entry));
if(process.argv.includes('--list')){
 output({inventory:feedbackReferenceInventory(),covered:allCases.map(({id,origin,references,userTurns})=>({id,origin,references,turns:userTurns.length})),pipeline:'production service + classification + response; in-memory repository; no HTTP/login/PostgreSQL/SED validation'});
 process.exit(0);
}
const at=process.argv.indexOf('--scenario');
if(at<0||!allCases.some(s=>s.id===process.argv[at+1]))throw Error('SELECT_ONE_SCENARIO_WITH_--scenario');
const requestOnly=process.argv.includes('--request-only');
const originalScenario=allCases.find(s=>s.id===process.argv[at+1]);
const scenario=requestOnly?{...originalScenario,userTurns:[originalScenario.userTurns.slice(0,2).join('\n\n')]}:originalScenario;
if(!process.env.ANTHROPIC_API_KEY&&!process.argv.includes('--check-pipeline'))throw Error('ANTHROPIC_API_KEY_REQUIRED');
if(process.env.PRIORIS_AI_PROVIDER!=='anthropic')throw Error('DIRECT_ANTHROPIC_REQUIRED');
const statePath=process.env.IAI_EVAL_STATE||resolve(root,'../api-budget.json');
const cap=Number(process.env.IAI_EVAL_MAX_USD||1);
if(!(cap>0&&cap<=1))throw Error('INVALID_EVALUATION_CAP');
const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{};
const initialCallCount=state.calls?.length||0;
const save=()=>writeFileSync(statePath,JSON.stringify(state,null,2));
state.charged??=0;state.calls??=[];
const budget={snapshot:()=>({capUSD:state.cap/1e6,estimatedUSD:state.charged/1e6,remainingUSD:Math.max(0,state.cap-state.charged)/1e6,calls:state.calls.length,blocked:state.blocked,estimated:true})};
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
  const price=PRICES[payload.model];
  if(!price||payload.max_tokens>price.maxOutput||state.blocked)throw Error('PILOT_BUDGET_BLOCKED');
  // The provider's free token counter avoids stopping a small real bill on a
  // byte-based reservation. Keep framing margin and 2x input-price reserve.
  const count=await rawClient.messages.countTokens({model:payload.model,system:payload.system,messages:payload.messages,tools:payload.tools,tool_choice:payload.tool_choice});
  if(!Number.isSafeInteger(count.input_tokens)||count.input_tokens<0)throw Error('TOKEN_COUNT_UNVERIFIED');
  const inputBound=Math.ceil(count.input_tokens*1.05)+8192;
  const reserved=inputBound*price.input*2+payload.max_tokens*price.output;
  if(state.charged+reserved>state.cap)throw Error('PILOT_BUDGET_LIMIT');
  const entry={model:payload.model,inputBound,maxOutput:payload.max_tokens,reservedMicroUSD:reserved,status:'reserved'};
  state.charged+=reserved;state.calls.push(entry);save();
  let reply;
  try{reply=await rawClient.messages.create(payload);}catch(error){entry.status='uncertain-held';state.blocked=true;save();throw error;}
  const u=reply.usage;
  const numbers=['input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens'].map(k=>u?.[k]??(k.startsWith('cache_')?0:NaN));
  if(numbers.some(n=>!Number.isSafeInteger(n)||n<0)){entry.status='unknown-usage-held';state.blocked=true;save();throw Error('PILOT_USAGE_UNVERIFIED');}
  const [input,usedOutput,cacheWrite,cacheRead]=numbers;
  const estimated=input*price.input+usedOutput*price.output+cacheWrite*price.input*2+cacheRead*price.input;
  entry.usage={input,output:usedOutput,cacheWrite,cacheRead};entry.estimatedMicroUSD=estimated;
  if(input+cacheWrite+cacheRead>inputBound||usedOutput>payload.max_tokens||estimated>reserved){entry.status='bound-exceeded';state.blocked=true;save();throw Error('PILOT_USAGE_UNVERIFIED');}
  state.charged+=estimated-reserved;entry.status='accounted';save();
  output({event:'usage',turn:activeTurn,call,model:payload.model,usage:reply.usage,budget:budget.snapshot()});
  return reply;
 }catch(error){output({event:'call_stopped',turn:activeTurn,call,error:redact(error.message),budget:budget.snapshot()});throw error;}
}}};
const providers=createModelProviders({client,
 onGenerationObservation:entry=>{lastGeneration=entry;output({event:'generation',turn:activeTurn,attempt:entry.attempt,agent:entry.agent,text:entry.input?.text,delivery:entry.input?.delivery,authorship:entry.input?.authorship,stage:entry.input?.stage});},
 onValidationObservation:entry=>{lastValidation=entry;output({event:'validation',turn:activeTurn,attempt:entry.attempt,phase:entry.phase,code:entry.code,reason:entry.reason});},
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
output({event:'start',scenario:scenario.id,origin:scenario.origin,references:scenario.references,baseHead:'79b0a57b7359b8a90324988bf7d444fd2e79d694',sourceHash,pipeline:'production service + providers; isolated memory storage',evaluationMode:requestOnly?'single-request diagnostic':'full conversation',capUSD:cap});
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
  if(!requestOnly&&index===scenario.userTurns.length-1&&result.status!=='closed')flags.push('EXPLICIT_CLOSE_IGNORED');
  if(lastValidation?.code&&lastValidation.code!=='ACCEPTED')flags.push('RECOVERY_NOT_MODEL_SUCCESS');
  if(/^(?:Leitura(?: do momento)?|Tensão(?: central)?|Direcionamento(?: prático)?):?/imu.test(result.text))flags.push('MECHANICAL_HEADINGS');
  output({event:'assistant',turn:activeTurn,text:result.text,status:result.status,route:result.route,flags});
  if(flags.length){passed=false;break;}
 }catch(error){passed=false;output({event:'turn_stopped',turn:activeTurn,error:redact(error.message),validation:lastValidation?.code,generationStage:lastGeneration?.input?.stage});break;}
}
output({event:'summary',scenario:scenario.id,completed:passed,evaluationMode:requestOnly?'single-request diagnostic':'full conversation',modelCalls:state.calls.length-initialCallCount,budget:budget.snapshot(),acceptance:'requires human review of the transcript; no claim of HTTP/login/database/SED validation'});
process.exitCode=passed?0:1;
