'use strict';
const {randomUUID,createHash}=require('node:crypto');
const IDENTITY=Object.freeze({id:'00000000-0000-4000-8000-000000000301',organizationId:'00000000-0000-4000-8000-000000000302',organizationName:'Empresa fictícia — piloto',email:'piloto@example.invalid',role:'leader'});
function createPilotStore(state,save=()=>{}) {
 const owned=s=>s?.userId===IDENTITY.id&&s?.organizationId===IDENTITY.organizationId;
 state.requests??={};
 const getSession=async(s,id)=>owned(s)&&state.session?.id===id?structuredClone(state.session):null;
 const repository={
  getSession,
  getHistorySettings:async s=>{if(!owned(s))throw Error('PILOT_SCOPE_DENIED');return {enabled:false,noticeVersion:null,revision:'pilot-history-off'};},
  readPrivateHistory:async()=>{throw Error('PILOT_HISTORY_DISABLED');},
  getCompletedRequest:async(s,id,requestId)=>owned(s)&&state.session?.id===id?state.requests[requestId]:null,
  commitTurn:async(s,t)=>{
   if(!owned(s)||state.session?.id!==t.sessionId||t.expectedCount!==state.session.exchangeCount||t.settingsRevision!=='pilot-history-off'||t.privateRecord)return false;
   if(state.requests[t.requestId])return false;
   state.requests[t.requestId]={contentHash:t.contentHash};
   state.session={...state.session,context:t.context,status:t.status,agentType:t.agent,exchangeCount:t.nextCount};save();return true;
  },
 };
 function open(s){
  if(!owned(s))throw Error('PILOT_SCOPE_DENIED');
  if(!state.session){state.session={id:randomUUID(),userId:IDENTITY.id,organizationId:IDENTITY.organizationId,agentType:'MNT',status:'active',exchangeCount:0,context:{}};save();}
  return {...structuredClone(state.session),messages:state.session.context?.messages??[]};
 }
 return {repository,open,identity:IDENTITY};
}
module.exports={createPilotStore,IDENTITY};
