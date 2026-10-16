'use strict';
// Isolated real-model conversation evaluation; original pilot remains untouched.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const root=process.cwd(),dir=path.resolve('generated-artifacts/ex05-live-20261015');fs.mkdirSync(dir,{recursive:true});
const prior=path.resolve('generated-artifacts/pilot-campaign/state-v1.json');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const priorHash='1c67f23e622e277eeefd2e52bbbb00261bf978cd2e1005122cb2b67979881d29';
if(digest(prior)!==priorHash)throw Error('ORIGINAL_PILOT_CHANGED');
const {createPilotPersistence}=require('../artifacts/api-server/src/lib/pilot-persistence.cjs');
const {createPilotBudget}=require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const {createPilotStore}=require('../artifacts/api-server/src/lib/pilot-store.cjs');
const {pilotIdentity}=require('../artifacts/api-server/src/lib/pilot-next-round.cjs');
const {createConversationService}=require('../artifacts/api-server/src/lib/conversation-service.cjs');
const {resolveContract}=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
const {inspectOperation,operationMessages,admitIndependentCase,ADMISSION_REVISION}=require('../artifacts/api-server/src/lib/ex05-operation-recovery.cjs');
const file=path.join(dir,'campaign.json');
if(!fs.existsSync(file)){
 const initial={schema:'ex05-isolated-real-v1',authorization:{date:'2026-10-15',quote:'sim, pode usar os $10 conforme necessidade... pode seguir',additionalCeilingUSD:10,initialProductAllocationUSD:5,agentRequestsAfterRefill:0},priorCampaign:{path:prior,sha256:priorHash,conservativelyDeductedUSD:5,untouched:true},budget:{cap:5000000,charged:0,calls:[],blocked:false},cases:{},operations:{}};
 fs.writeFileSync(file,JSON.stringify(initial),{mode:0o600,flag:'wx'});
}
const campaign=JSON.parse(fs.readFileSync(file,'utf8')),persistence=createPilotPersistence(file,campaign);
const release=persistence.acquireRequest();
// Re-read under exclusivity; another writer could have finished after initial read.
persistence.refresh();
const save=()=>persistence.save();
const api=Module.createRequire(path.resolve('artifacts/api-server/package.json'));
const command=process.argv[2];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function view(caseId,result){
 const item=campaign.cases[caseId],messages=operationMessages(campaign,caseId,result);
 const rows=messages.map(m=>`<article class="${m.role}"><b>${m.role==='user'?'Líder':'IAí'}</b><p>${escape(m.content)}</p></article>`).join('');
 const error=result.error?`<article><b>Interação interrompida</b><p>${escape(result.error)}</p></article>`:'';
 const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>IAí · avaliação conversacional</title><style>body{font:17px/1.5 system-ui;background:#141414;color:#eee;max-width:900px;margin:28px auto;padding:0 20px}h1{color:#d8b969;font-size:24px}small{color:#aaa}article{padding:15px 22px;background:#242424;border-radius:12px;margin:15px 0}.user{margin-right:80px}.assistant{margin-left:60px;border-left:3px solid #d8b969}p{white-space:pre-wrap;margin:8px 0}b{color:#d8b969}</style><h1>IAí · avaliação conversacional</h1><small>Dados fictícios · motor real · sem SED · sessão ${escape(caseId)}</small>${rows}${error}<small>Conversa ${escape(result.status??'em avaliação')} · ${item?.session?.exchangeCount??0} trocas</small></html>`;
 fs.writeFileSync(path.resolve('artifacts/iai-web/public/ex05-current.html'),html);
 fs.writeFileSync(path.resolve('artifacts/iai-web/public/ex05-'+caseId+'.html'),html);
 fs.writeFileSync(path.join(dir,'latest-result.json'),JSON.stringify(result,null,2));
}
async function main(){
 if(command==='init'){save();return {initialized:true,additionalAuthorizedUSD:10,productBatchCeilingUSD:5,originalUntouched:digest(prior)===priorHash};}
 if(command==='status')return {budget:createPilotBudget(campaign.budget,save).snapshot(),cases:Object.fromEntries(Object.entries(campaign.cases).map(([id,c])=>[id,{count:c.session?.exchangeCount,status:c.session?.status}]))};
 const input=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),id=input.caseId;
 if(!/^L2[1-9]$/.test(id))throw Error('INVALID_CASE');
 // acquireRequest above proves exclusive ownership on this shared local store.
 // Recover only stored output, or explicitly retain uncertainty. No SDK is built.
 if(command==='recover'){
  const result=inspectOperation(campaign,id,input.requestId,{activeRequest:false});
  view(id,result);return result;
 }
 if(command==='finish'){
  const current=campaign.cases[id];if(!current)throw Error('CASE_NOT_STARTED');current.actorOutcome=input.outcome;current.actorFeedback=input.feedback??null;save();const result={caseId:id,status:input.outcome};view(id,result);return result;
 }
 if(command!=='turn'||typeof input.content!=='string'||input.content.length>6000)throw Error('INVALID_COMMAND');
 const requestId=input.requestId;
 if(!/^L\d\d-T\d\d-[a-z0-9-]+$/.test(requestId))throw Error('INVALID_REQUEST_ID');
 if(campaign.operations[requestId])return inspectOperation(campaign,id,requestId,{activeRequest:false});
 const admission=admitIndependentCase(campaign,id,file);
 for(const {requestId:pendingId,proof} of admission.pending)
  campaign.operations[pendingId].independentRecovery=proof;
 if(admission.pending.length)save();
 if(campaign.budget.blocked)throw Error('CAMPAIGN_BLOCKED');
 campaign.budget.currentRound=Number(id.slice(1));
 const state={...(campaign.cases[id]??{}),budget:campaign.budget,
  ...(admission.pending.length?{independentAdmission:{revision:admission.revision,pending:admission.pending.map(p=>p.requestId)}}:{})};
 const saveCase=()=>{const {budget,...current}=state;campaign.cases[id]=current;save();};
 const identity=pilotIdentity(Number(id.slice(1))),scope={userId:identity.id,organizationId:identity.organizationId};
 const store=createPilotStore(state,saveCase,identity),session=store.open(scope);
 campaign.operations[requestId]={caseId:id,status:'processing',input:input.content,startedAt:Date.now(),
  execution:{revision:ADMISSION_REVISION,owner:JSON.parse(fs.readFileSync(file+'.request-lock/owner.json','utf8')),callStartIndex:campaign.budget.calls.length}};saveCase();
 const budget=createPilotBudget(campaign.budget,saveCase);
 const Anthropic=api('@anthropic-ai/sdk').default;
 const sdk=new Anthropic({apiKey:process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,baseURL:process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,maxRetries:0,timeout:30000});
 const built=api('esbuild').buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
 const filename=path.resolve('artifacts/api-server/ex05-runtime.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(built.outputFiles[0].text,filename);
 const send=async payload=>{
  const started=Date.now();
  try{const response=await sdk.messages.create(payload);campaign.providerEvents??=[];campaign.providerEvents.push({caseId:id,requestId,model:payload.model,durationMs:Date.now()-started,stopReason:response.stop_reason});saveCase();return response;}
  catch(e){campaign.providerEvents??=[];campaign.providerEvents.push({caseId:id,requestId,model:payload.model,durationMs:Date.now()-started,error:{name:e.name,status:e.status??null,code:typeof e.code==='string'?e.code:null,type:typeof e.error?.type==='string'?e.error.type:null}});saveCase();throw e;}
 };
 const providers=mod.exports.createModelProviders({client:{messages:{create:payload=>budget.call(payload,send)}},onGenerationObservation:entry=>store.repository.recordGenerationObservation(scope,entry),onValidationObservation:entry=>store.repository.recordValidation(scope,entry)});
 const classify=async args=>{const value=await providers.classify(args);state.classificationAttempts??=[];state.classificationAttempts.push({requestId,value});saveCase();return value;};
 const service=createConversationService({repository:store.repository,classify,respond:providers.respond,agentPrompts:Object.fromEntries(resolveContract().agents.map(a=>[a.id,a.prompt]))});
 const startCalls=campaign.budget.calls.length;
 let result;
 try{const r=await service.turn(scope,{sessionId:session.id,requestId,content:input.content});result={caseId:id,requestId,...r};}
 catch(e){result={caseId:id,requestId,error:e.code??'MODEL_OR_RUNTIME_FAILURE',status:'failed'};}
 result.callsThisTurn=campaign.budget.calls.length-startCalls;result.batchBudget=budget.snapshot();
 campaign.operations[requestId]={...campaign.operations[requestId],status:result.error?'failed':'completed',endedAt:Date.now(),result};saveCase();view(id,result);
 if(digest(prior)!==priorHash)throw Error('ORIGINAL_PILOT_CHANGED');return result;
}
main().then(result=>console.log(JSON.stringify(result))).catch(e=>{console.log(JSON.stringify({error:e.code??e.message??'RUNNER_FAILED'}));process.exitCode=1;}).finally(()=>release());
