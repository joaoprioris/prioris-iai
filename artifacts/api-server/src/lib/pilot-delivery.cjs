'use strict';
const {createHash}=require('node:crypto');
const digest=text=>createHash('sha256').update(text).digest('hex');
const descriptions={
 processing:'Envio registrado; processamento em andamento. Não reenvie.',
 completed:'Resposta concluída e recuperada do registro do piloto.',
 MODEL_UNAVAILABLE:'A chamada terminou sem uma resposta disponível. A causa externa não foi comprovada; eventual uso incerto permanece reservado. Não há reenvio automático.',
 INVALID_MODEL_RESPONSE:'A resposta foi recusada pelos controles de interpretação/validação. Não é evidência de indisponibilidade do serviço.',
 STORAGE_UNAVAILABLE:'Não foi possível confirmar a gravação. Consulte o estado novamente; não reenvie automaticamente.',
 INTERRUPTED_UNCONFIRMED:'O servidor reiniciou antes de confirmar o resultado local. O resultado remoto é desconhecido e as reservas foram preservadas. Não há reenvio automático.',
};
function createPilotDelivery(state,save){
 let storageFailed=false;
 function transaction(change){
  const before=structuredClone(state.delivery);
  try{const result=change();save();return result;}
  catch(e){if(before===undefined)delete state.delivery;else state.delivery=before;throw e;}
 }
 function view(){
  const entries=Object.values(state.delivery||{});
  // Historical evidence stays unchanged; displayed text comes only from actual
  // user inputs and committed results, never hidden generation fields.
  const messages=[],seen=new Set();
  for(const a of state.audit||[]){
   const source=a.messages?.at(-1);
   if(source?.role!=='user'||!a.requestId)continue;
   seen.add(a.requestId);
   messages.push({role:'user',content:source.content,requestId:a.requestId});
   if(a.outcome==='completed'&&a.result?.text)messages.push({role:'assistant',content:a.result.text});
  }
  // Old fixtures without audit inputs can still recover operational context.
  const context=state.session?.context?.messages;
  const visible=messages.length?messages:Array.isArray(context)?structuredClone(context):[];
  for(const d of entries){
   if(!seen.has(d.requestId)){
    visible.push({role:'user',content:d.content,requestId:d.requestId});
    if(d.status==='completed'&&d.result?.text)visible.push({role:'assistant',content:d.result.text});
   }
  }
  const historical=(state.audit||[]).filter(a=>a.outcome==='failed'&&!state.delivery?.[a.requestId]).map(a=>({requestId:a.requestId,status:'failed',code:a.failure?.code}));
  return {messages:visible,storageFailed,deliveries:[...historical,...entries].map(d=>({...d,...(storageFailed&&d.status==='processing'?{status:'uncertain',code:'STORAGE_UNAVAILABLE'}:{}),description:descriptions[storageFailed&&d.status==='processing'?'STORAGE_UNAVAILABLE':d.code||d.status]??'Envio recusado. Consulte o código registrado; não houve reenvio automático.'}))};
 }
 function begin(input,inFlight){
  if(!state.session||input?.sessionId!==state.session.id)throw Error('SESSION_NOT_FOUND');
  if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId)||typeof input.content!=='string'||!input.content.trim()||input.content.length>8000)throw Error('INVALID_INPUT');
  const previous=state.audit?.find(a=>a.requestId===input.requestId);
  if(previous&&!state.delivery?.[input.requestId]){
   if(previous.inputHash!==digest(input.content.trim()))throw Error('IDEMPOTENCY_CONFLICT');
   return {replay:true,entry:previous};
  }
  const old=state.delivery?.[input.requestId];
  if(old){if(old.contentHash!==digest(input.content.trim()))throw Error('IDEMPOTENCY_CONFLICT');return {replay:true,entry:old};}
  if(inFlight||Object.values(state.delivery||{}).some(d=>d.status==='processing'))throw Error('TURN_IN_PROGRESS');
  if(state.session.status!=='active')throw Error('SESSION_CLOSED');
  return transaction(()=>{
   state.delivery??={};
   const entry={requestId:input.requestId,sessionId:input.sessionId,content:input.content.trim(),contentHash:digest(input.content.trim()),status:'processing',at:Date.now()};
   state.delivery[input.requestId]=entry;return {replay:false,entry};
  });
 }
 function finish(id,code){
  if(!state.delivery?.[id]||state.delivery[id].status==='completed')return;
  try { transaction(()=>{
   const d=state.delivery[id];
   d.status='failed';d.code=code;d.endedAt=Date.now();
  }); }catch(err){storageFailed=true;throw err;}
 }
 function recoverRestart(){
  if(!Object.values(state.delivery||{}).some(d=>d.status==='processing'))return;
  transaction(()=>{for(const d of Object.values(state.delivery)){
   if(d.status==='processing'){
    d.status=state.requests?.[d.requestId]?'completed':'uncertain';
    if(d.status!=='completed')d.code='INTERRUPTED_UNCONFIRMED';
   }
  }});
 }
 return {begin,finish,view,recoverRestart};
}
module.exports={createPilotDelivery};
