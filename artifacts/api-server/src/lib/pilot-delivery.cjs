'use strict';
const {createHash}=require('node:crypto');
const {assertPilotInputCapacity}=require('./pilot-store.cjs');
const {recoverInputReceipts,RECOVERY_REQUIRED_MESSAGE}=require('./conversation-service.cjs');
const {localExecutionOwner,executionOwnerState}=require('./pilot-persistence.cjs');
const digest=text=>createHash('sha256').update(text).digest('hex');
const descriptions={
 processing:'Envio registrado; processamento em andamento. Não reenvie.',
 completed:'Resposta concluída e recuperada do registro do piloto.',
 MODEL_UNAVAILABLE:'A chamada terminou sem uma resposta disponível. A causa externa não foi comprovada; eventual uso incerto permanece reservado. Não há reenvio automático.',
 INVALID_MODEL_RESPONSE:'A resposta foi recusada pelos controles de interpretação/validação. Não é evidência de indisponibilidade do serviço.',
 STORAGE_UNAVAILABLE:'Não foi possível confirmar a gravação. Consulte o estado novamente; não reenvie automaticamente.',
 INTERRUPTED_UNCONFIRMED:'O servidor reiniciou antes de confirmar o resultado local. O resultado remoto é desconhecido e as reservas foram preservadas. Não há reenvio automático.',
 RESULT_UNCONFIRMED:'Envio preservado a partir da observação externa. Resultado remoto e uso desconhecidos; chamadas suspensas e margem adicional mantida. Não repetir.',
 RECOVERY_REQUIRED:RECOVERY_REQUIRED_MESSAGE,
};
function createPilotDelivery(state,save){
 let storageFailed=false;
 function transaction(change){
  const before=structuredClone(state.delivery);
  const session=structuredClone(state.session);
  try{const result=change();save();return result;}
  catch(e){if(before===undefined)delete state.delivery;else state.delivery=before;state.session=session;throw e;}
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
   // External recovery explicitly supplies the same confirmed pair as its
   // operational context. Display that pair once; don't collapse ordinary
   // requests merely because their texts happen to match.
   if(d.source==='external-observation'&&d.status==='completed'&&visible.some((m,i)=>m.role==='user'&&m.content===d.content&&visible[i+1]?.role==='assistant'&&visible[i+1]?.content===d.result?.text))continue;
   if(!seen.has(d.requestId)){
    visible.push({role:'user',content:d.content,requestId:d.requestId});
    if(d.status==='completed'&&d.result?.text)visible.push({role:'assistant',content:d.result.text});
   }
  }
  const historical=(state.audit||[]).filter(a=>a.outcome==='failed'&&!Object.hasOwn(state.delivery||{},a.requestId)).map(a=>({requestId:a.requestId,status:'failed',code:a.failure?.code}));
  return {messages:visible,storageFailed,deliveries:[...historical,...entries].map(d=>({...d,...(storageFailed&&d.status==='processing'?{status:'uncertain',code:'STORAGE_UNAVAILABLE'}:{}),description:d.source==='external-observation'&&d.status==='completed'?'Resposta recuperada da observação externa preservada; classificação, geração bruta e usage originais não foram recuperados.':descriptions[storageFailed&&d.status==='processing'?'STORAGE_UNAVAILABLE':d.code||d.status]??'Envio recusado. Consulte o código registrado; não houve reenvio automático.'}))};
 }
 function begin(input,inFlight){
  if(!state.session||input?.sessionId!==state.session.id)throw Error('SESSION_NOT_FOUND');
  if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId)||typeof input.content!=='string'||!input.content.trim()||input.content.length>8000)throw Error('INVALID_INPUT');
  const previous=state.audit?.find(a=>a.requestId===input.requestId);
  if(previous&&!Object.hasOwn(state.delivery||{},input.requestId)){
   if(previous.inputHash!==digest(input.content.trim()))throw Error('IDEMPOTENCY_CONFLICT');
   return {replay:true,entry:previous};
  }
  const old=Object.hasOwn(state.delivery||{},input.requestId)?state.delivery[input.requestId]:null;
  if(old){if(old.contentHash!==digest(input.content.trim()))throw Error('IDEMPOTENCY_CONFLICT');return {replay:true,entry:old};}
  if(inFlight)throw Error('TURN_IN_PROGRESS');
  recoverRestart();
  recoverInputReceipts(state.session.context);
  if(Object.values(state.delivery||{}).some(d=>d.status==='uncertain'&&d.code==='RECOVERY_REQUIRED'))throw Error('RECOVERY_REQUIRED');
  if(Object.values(state.delivery||{}).some(d=>d.status==='processing'))throw Error('TURN_IN_PROGRESS');
  if(state.session.status!=='active')throw Error('SESSION_CLOSED');
  assertPilotInputCapacity(state,input.content.trim(),input.requestId);
  return transaction(()=>{
   state.delivery??={};
   const entry={requestId:input.requestId,sessionId:input.sessionId,content:input.content.trim(),contentHash:digest(input.content.trim()),status:'processing',owner:localExecutionOwner(),at:Date.now()};
   state.delivery[input.requestId]=entry;return {replay:false,entry};
  });
 }
 function finish(id,code){
  if(!Object.hasOwn(state.delivery||{},id)||state.delivery[id].status==='completed')return;
  try { transaction(()=>{
   const d=state.delivery[id];
   d.status='failed';d.code=code;d.endedAt=Date.now();
  }); }catch(err){storageFailed=true;throw err;}
 }
 function recoverRestart(){
  let context;try{context=recoverInputReceipts(state.session?.context);}catch{}
  const changed=context&&JSON.stringify(context)!==JSON.stringify(state.session?.context||{});
  const entries=Object.values(state.delivery||{});
  if(!changed&&!entries.some(d=>d.status==='processing'&&(Object.hasOwn(state.requests||{},d.requestId)||executionOwnerState(d.owner)!=='active')))return;
  transaction(()=>{if(changed)state.session.context=context;for(const d of entries){
   if(d.status==='processing'){
    if(Object.hasOwn(state.requests||{},d.requestId)){d.status='completed';continue;}
    const owner=executionOwnerState(d.owner);if(owner==='active')continue;
    d.status='uncertain';d.code=owner==='terminated'?'INTERRUPTED_UNCONFIRMED':'RECOVERY_REQUIRED';
   }
  }});
 }
 return {begin,finish,view,recoverRestart};
}
module.exports={createPilotDelivery};
