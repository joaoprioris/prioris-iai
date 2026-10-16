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
module.exports={inspectOperation,operationMessages};
