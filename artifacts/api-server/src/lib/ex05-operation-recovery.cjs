'use strict';
// Read-only projection. Never settles charges, commits a turn or invokes a model.
function inspectOperation(campaign, caseId, requestId, {activeRequest=true}={}) {
 const operation=campaign.operations?.[requestId];
 if(!operation)return {requestId,status:'missing',error:'OPERATION_NOT_FOUND'};
 if(operation.caseId!==caseId)throw Error('SCOPE_DENIED');
 const item=campaign.cases?.[caseId];
 const audit=item?.audit?.findLast(a=>a.requestId===requestId&&a.sessionId===item.session?.id);
 const completed=[operation.result,audit?.outcome==='completed'?audit.result:null,
  item?.delivery?.[requestId]?.status==='completed'?item.delivery[requestId].result:null]
  .filter(r=>typeof r?.text==='string'&&r.text.trim());
 if(new Set(completed.map(r=>r.text)).size>1)
  return {caseId,requestId,status:'uncertain',error:'RECOVERY_CONFLICT',replayPrevented:true};
 if(completed.length)return {...structuredClone(completed[0]),caseId,requestId,replayed:true,
  recoverySource:operation.result?.text?'operation-result':'committed-delivery'};
 if(operation.result)return {...structuredClone(operation.result),caseId,requestId,replayed:true};
 if(activeRequest!==false)return {caseId,requestId,status:'processing',replayPrevented:true};
 return {caseId,requestId,status:'uncertain',error:'RESULT_UNCONFIRMED',
  replayPrevented:true,noAutomaticRetry:true,reservationsPreserved:true};
}
function operationMessages(campaign,caseId,recovered={}) {
 return Object.entries(campaign.operations??{}).filter(([,o])=>o.caseId===caseId).flatMap(([id,o])=>{
  const text=id===recovered.requestId&&recovered.text?recovered.text:o.result?.text;
  return [{role:'user',content:o.input},...(text?[{role:'assistant',content:text}]:[])];
 });
}
// Admission is local to the same Linux host/store, under the existing request lock.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PRICES}=require('./pilot-budget.cjs');
const ADMISSION_REVISION='EX05-2-independent-1';
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function identity(pid){
 try{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()+':'+s.slice(s.lastIndexOf(')')+2).split(' ')[19];}
 catch{return null;}
}
function admitIndependentCase(campaign,caseId,file){
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const current=read(file+'.request-lock/owner.json');
 if(current.pid!==process.pid||current.processIdentity!==identity(process.pid))fail('REQUEST_LOCK_NOT_OWNED');
 const pending=Object.entries(campaign.operations??{}).filter(([id,o])=>
  o.status==='processing'&&!o.result&&!inspectOperation(campaign,o.caseId,id,{activeRequest:false}).text);
 if(!pending.length)return {revision:ADMISSION_REVISION,pending:[]};
 if(pending.some(([,o])=>o.caseId===caseId))fail('PENDING_CASE_UNCERTAIN');
 if(campaign.cases?.[caseId]&&!campaign.cases[caseId].independentAdmission)fail('NEW_INDEPENDENT_CASE_REQUIRED');
 const b=campaign.budget,calls=b?.calls;
 if(!b||b.blocked||!Array.isArray(calls)||!Number.isSafeInteger(b.charged)||
   !Number.isSafeInteger(b.cap)||b.charged<0||b.charged>b.cap)fail('RESERVATION_COVERAGE_UNVERIFIED');
 let liabilities=0;
 for(const c of calls){
  if(c.status==='accounted'){
   if(!Number.isSafeInteger(c.estimatedMicroUSD)||c.estimatedMicroUSD<0)fail('RESERVATION_COVERAGE_UNVERIFIED');
   liabilities+=c.estimatedMicroUSD;
  }else if(['reserved','uncertain-held'].includes(c.status)){
   const p=PRICES[c.model];
   if(!p||!Number.isSafeInteger(c.inputBound)||c.inputBound<8192||c.inputBound>180000||
    !Number.isSafeInteger(c.maxOutput)||c.maxOutput<1||c.maxOutput>p.maxOutput||
    !Number.isSafeInteger(c.reservedMicroUSD)||c.reservedMicroUSD<c.inputBound*p.input*2+c.maxOutput*p.output)
    fail('RESERVATION_COVERAGE_UNVERIFIED');
   liabilities+=c.reservedMicroUSD;
  }else fail('RESERVATION_COVERAGE_UNVERIFIED');
 }
 if(!Number.isSafeInteger(liabilities)||b.charged<liabilities)fail('RESERVATION_NOT_FULLY_DEDUCTED');
 const dir=path.dirname(file),used=new Set(),proofs=[];
 for(const [requestId,o] of pending){
  if(inspectOperation(campaign,o.caseId,requestId,{activeRequest:false}).error!=='RESULT_UNCONFIRMED')fail('RECOVERY_CONFLICT');
  let proof=o.independentRecovery;
  if(!proof){
   const entries=fs.readdirSync(path.join(dir,'lock-recovery')).filter(n=>n.startsWith(path.basename(file)+'.request-lock.'));
   let candidates=entries.map(n=>{
    const relative=path.join('lock-recovery',n,'owner.json'),raw=fs.readFileSync(path.join(dir,relative));
    return {ownerPath:relative,ownerSHA256:digest(raw),owner:JSON.parse(raw)};
   });
   let indices;
   if(o.execution?.owner){
    candidates=candidates.filter(c=>JSON.stringify(c.owner)===JSON.stringify(o.execution.owner));
    if(!Number.isSafeInteger(o.execution.callStartIndex)||o.execution.callStartIndex<0)fail('RECOVERY_EVIDENCE_INSUFFICIENT');
    indices=calls.map((c,i)=>i>=o.execution.callStartIndex&&c.round===Number(o.caseId.slice(1))&&['reserved','uncertain-held'].includes(c.status)?i:-1).filter(i=>i>=0);
   }else{
    // Legacy: only one unfinished operation, a prior explicit recovery, and the
    // final outstanding reservation in its round. No guessed PID or token usage.
    const r=read(path.join(dir,'latest-result.json')),last=calls.length-1;
    if(pending.length!==1||r.caseId!==o.caseId||r.requestId!==requestId||
     r.error!=='RESULT_UNCONFIRMED'||r.noAutomaticRetry!==true||
     calls[last]?.status!=='reserved'||calls[last]?.round!==Number(o.caseId.slice(1)))
     fail('RECOVERY_EVIDENCE_INSUFFICIENT');
    indices=[last];
   }
   if(candidates.length!==1||!indices.length)fail('RECOVERY_EVIDENCE_INSUFFICIENT');
   proof={revision:ADMISSION_REVISION,...candidates[0],reservations:indices.map(index=>({index,sha256:digest(JSON.stringify(calls[index]))}))};
  }
  if(proof.revision!==ADMISSION_REVISION||!/^lock-recovery\/[^/]+\/owner\.json$/.test(proof.ownerPath??'')||
   !path.basename(path.dirname(proof.ownerPath)).startsWith(path.basename(file)+'.request-lock.'))fail('RECOVERY_EVIDENCE_INSUFFICIENT');
  const raw=fs.readFileSync(path.join(dir,proof.ownerPath)),owner=JSON.parse(raw);
  if(digest(raw)!==proof.ownerSHA256||JSON.stringify(owner)!==JSON.stringify(proof.owner)||
   !Number.isInteger(owner.pid)||owner.pid<1||!/^[-0-9a-f]{36}:\d+$/.test(owner.processIdentity??''))fail('RECOVERY_EVIDENCE_INSUFFICIENT');
  const live=identity(owner.pid);
  if(live===owner.processIdentity)fail('PENDING_OWNER_ACTIVE');
  if(live===null&&fs.existsSync('/proc/'+owner.pid))fail('PENDING_OWNER_UNVERIFIABLE');
  if(!Array.isArray(proof.reservations)||!proof.reservations.length)fail('RESERVATION_COVERAGE_UNVERIFIED');
  for(const r of proof.reservations){
   const c=calls[r.index];
   if(!Number.isSafeInteger(r.index)||used.has(r.index)||!c||c.round!==Number(o.caseId.slice(1))||
    !['reserved','uncertain-held'].includes(c.status)||digest(JSON.stringify(c))!==r.sha256)fail('RESERVATION_COVERAGE_UNVERIFIED');
   used.add(r.index);
  }
  proofs.push({requestId,proof:{...proof,verifiedAt:Date.now(),localTerminationVerified:true,remoteResult:'unconfirmed'}});
 }
 return {revision:ADMISSION_REVISION,pending:proofs};
}
module.exports={inspectOperation,operationMessages,admitIndependentCase,ADMISSION_REVISION};
