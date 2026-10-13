'use strict';
const {randomUUID,createHash}=require('node:crypto');
const IDENTITY=Object.freeze({id:'00000000-0000-4000-8000-000000000301',organizationId:'00000000-0000-4000-8000-000000000302',organizationName:'Empresa fictícia — piloto',email:'piloto@example.invalid',role:'leader'});
function createPilotStore(state,save=()=>{},identity=IDENTITY) {
 const owned=s=>s?.userId===identity.id&&s?.organizationId===identity.organizationId;
 state.requests??={};
 const getSession=async(s,id)=>owned(s)&&state.session?.id===id?structuredClone(state.session):null;
 const repository={
  getSession,
  getHistorySettings:async s=>{if(!owned(s))throw Error('PILOT_SCOPE_DENIED');return {enabled:false,noticeVersion:null,revision:'pilot-history-off'};},
  readPrivateHistory:async()=>{throw Error('PILOT_HISTORY_DISABLED');},
  getCompletedRequest:async(s,id,requestId)=>owned(s)&&state.session?.id===id?state.requests[requestId]:null,
  recordObservation:async(s,entry)=>{
   if(!owned(s)||state.session?.id!==entry.sessionId)throw Error('PILOT_SCOPE_DENIED');
   state.audit??=[];state.audit.push({...structuredClone(entry),classificationCallIndex:state.budget?.calls?.length?state.budget.calls.length-1:null,outcome:'classified'});save();
  },
  recordGeneration:async(s,entry)=>{
   if(!owned(s)||state.session?.id!==entry.sessionId)throw Error('PILOT_SCOPE_DENIED');
   const audit=state.audit?.findLast(e=>e.requestId===entry.requestId);
   if(!audit)throw Error('PILOT_OBSERVATION_MISSING');
   audit.generation=structuredClone(entry.response);save();
  },
  recordGenerationObservation:async(s,entry)=>{
   if(!owned(s))throw Error('PILOT_SCOPE_DENIED');
   const audit=state.audit?.findLast(e=>e.turn===entry.turn&&e.sessionId===state.session?.id);
   if(!audit)throw Error('PILOT_OBSERVATION_MISSING');
   audit.generationAttempts??=[];audit.generationAttempts.push({...structuredClone(entry),budgetCallIndex:state.budget?.calls?.length?state.budget.calls.length-1:null});save();
  },
  commitTurn:async(s,t)=>{
   if(!owned(s)||state.session?.id!==t.sessionId||t.expectedCount!==state.session.exchangeCount||t.settingsRevision!=='pilot-history-off'||t.privateRecord)return false;
   if(state.requests[t.requestId])return false;
   state.requests[t.requestId]={contentHash:t.contentHash};
   const audit=state.audit?.findLast(e=>e.requestId===t.requestId);
   if(audit){audit.outcome='completed';audit.result=structuredClone(t.result);}
   state.session={...state.session,context:t.context,status:t.status,agentType:t.agent,exchangeCount:t.nextCount};save();return true;
  },
 };
 function open(s){
  if(!owned(s))throw Error('PILOT_SCOPE_DENIED');
  if(!state.session){state.session={id:randomUUID(),userId:identity.id,organizationId:identity.organizationId,agentType:'MNT',status:'active',exchangeCount:0,context:{}};save();}
  return {...structuredClone(state.session),messages:state.session.context?.messages??[]};
 }
 return {repository,open,identity};
}
module.exports={createPilotStore,IDENTITY};
