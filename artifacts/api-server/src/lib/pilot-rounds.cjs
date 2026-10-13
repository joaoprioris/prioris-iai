'use strict';
const {ROUTING_VERSION}=require('./functional-policy.cjs');
const SECOND_IDENTITY=Object.freeze({id:'00000000-0000-4000-8000-000000000303',organizationId:'00000000-0000-4000-8000-000000000304',organizationName:'Outra empresa fictícia — rodada 2',email:'outro-piloto@example.invalid',role:'leader'});
function prepareSecondRound(original,now=Date.now()) {
 if(original.version===ROUTING_VERSION){
  if(original.round!==2||!original.budget||!Array.isArray(original.archivedRounds))throw Error('PILOT_STATE_MISMATCH');
  return original; // restart never resets either deadline or cumulative budget
 }
 if(original.version!=='0.3.0'||!original.session||original.session.userId!=='00000000-0000-4000-8000-000000000301'||original.session.organizationId!=='00000000-0000-4000-8000-000000000302'||!Number.isSafeInteger(original.budget?.charged)||original.budget.charged<0||!Array.isArray(original.budget.calls))throw Error('PILOT_STATE_MISMATCH');
 const preserved=structuredClone(original);
 return {
  version:ROUTING_VERSION,round:2,provider:original.provider,createdAt:now,expiresAt:now+2*60*60*1000,
  archivedRounds:[{round:1,version:'0.3.0',endedBy:'abandonment-reported-by-user',classificationEvidence:'not-recorded',original:preserved}],
  budget:{...structuredClone(original.budget),currentRound:2,calls:original.budget.calls.map(c=>({...c,round:1}))},
  requests:{},audit:[],
 };
}
module.exports={prepareSecondRound,SECOND_IDENTITY};
