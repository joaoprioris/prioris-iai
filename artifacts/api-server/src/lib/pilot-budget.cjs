'use strict';
// Integer micro-USD. This is a conservative local estimate, not a billing API.
const PRICES=Object.freeze({
 'claude-haiku-4-5':{input:1,output:5,maxOutput:1200},
 'claude-sonnet-4-5':{input:3,output:15,maxOutput:2200},
});
function createPilotBudget(state,save=()=>{}) {
 state.cap=5000000;state.charged??=0;state.calls??=[];state.blocked??=false;
 // Owner authorized continued low-cost product tests; preserve all charges.
 if(state.blocked&&/^Reserva conservadora insuficiente/.test(state.blockReason??'')&&state.charged<state.cap){state.blocked=false;state.blockReason=null;save();}
 function snapshot(){
  const calls=state.calls.reduce((n,c)=>{
   const count=c.kind==='recovered-ui-summary'?c.callCount:1;
   if(!Number.isSafeInteger(count)||count<1)throw Error('PILOT_CALLCOUNT_UNVERIFIED');
   return n+count;
  },0);
  const uncertainReserved=state.calls.filter(c=>c.status==='uncertain-held').reduce((n,c)=>n+(c.reservedMicroUSD??0),0);
  const conservativeUncertainty=(state.conservativeHolds??[]).reduce((n,h)=>n+h.heldMicroUSD,0);
  return {capUSD:state.cap/1e6,estimatedUSD:state.charged/1e6,remainingUSD:Math.max(0,state.cap-state.charged)/1e6,calls,ledgerEntries:state.calls.length,recoveryHoldUSD:(state.recoveryHoldMicroUSD??0)/1e6,uncertainReservedUSD:uncertainReserved/1e6,conservativeUncertaintyUSD:conservativeUncertainty/1e6,usageDetailIncomplete:state.usageDetailIncomplete===true||uncertainReserved>0,blocked:state.blocked,reason:state.blockReason??null,estimated:true};
 }
 async function call(payload,send) {
  const price=PRICES[payload.model];
  if(state.blocked||!price||!Number.isInteger(payload.max_tokens)||payload.max_tokens<1||payload.max_tokens>price.maxOutput||payload.thinking||payload.cache_control||payload.stream)throw Error('PILOT_BUDGET_BLOCKED');
  // Includes system, complete conversation, tools/schema and all repair text.
  // 2 tokens per UTF-8 byte + framing allowance deliberately overestimates.
  const inputBound=Buffer.byteLength(JSON.stringify(payload),'utf8')*2+8192;
  if(inputBound>180000)throw Error('PILOT_INPUT_LIMIT');
  // Allow up to 2x input price (one-hour cache writes) even though we do not
  // request caching. Output uses the exact SDK max_tokens (600 / 2200).
  const reserved=inputBound*price.input*2+payload.max_tokens*price.output;
  if(state.charged+reserved>state.cap){state.blocked=true;state.blockReason='Reserva conservadora insuficiente dentro do teto de US$'+(state.cap/1e6)+'.';save();throw Error('PILOT_BUDGET_LIMIT');}
  const entry={model:payload.model,round:state.currentRound??1,inputBound,maxOutput:payload.max_tokens,reservedMicroUSD:reserved,status:'reserved'};
  state.charged+=reserved;state.calls.push(entry);save();
  let response;
  try{response=await send(payload);}catch(err){entry.status='uncertain-held';save();throw err;}
  const u=response?.usage;
  const keys=['input_tokens','output_tokens','cache_creation_input_tokens','cache_read_input_tokens'];
  const numbers=keys.map(k=>u?.[k]??(k.startsWith('cache_')?0:NaN));
  if(numbers.some(n=>!Number.isSafeInteger(n)||n<0)){
   entry.status='unknown-usage-held';state.blocked=true;save();throw Error('PILOT_USAGE_UNVERIFIED');
  }
  const [input,output,cacheWrite,cacheRead]=numbers;
  // Round upward; treating every cache write as 1h and every cache hit as
  // ordinary input costs at least its standard rate.
  const estimated=input*price.input+output*price.output+cacheWrite*price.input*2+cacheRead*price.input;
  entry.usage={input,output,cacheWrite,cacheRead};entry.estimatedMicroUSD=estimated;
  if(input+cacheWrite+cacheRead>inputBound||output>payload.max_tokens||estimated>reserved){
   entry.status='bound-exceeded';state.blocked=true;state.charged+=Math.max(0,estimated-reserved);save();throw Error('PILOT_USAGE_UNVERIFIED');
  }
  state.charged+=estimated-reserved;entry.status='accounted';save();
  return response;
 }
 return {snapshot,call};
}
module.exports={createPilotBudget,PRICES};
