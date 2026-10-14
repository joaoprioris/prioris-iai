'use strict';
// Explicit, one-time recovery from the owner's supplied external observation.
// Not a model replay, provider usage record, classification or generated audit.
const fs=require('node:fs'),crypto=require('node:crypto');
const {createPilotPersistence}=require('../artifacts/api-server/src/lib/pilot-persistence.cjs');
const file='generated-artifacts/pilot-campaign/state-v1.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=fs.readFileSync(file),state=JSON.parse(before);
const dir='generated-artifacts/pilot-consistency-preserved';
if(!fs.existsSync(dir+'/canonical-'+sha(before)+'.json'))throw Error('STATE_NOT_PRESERVED');
if(state.round!==20||state.session?.exchangeCount!==0||state.audit?.length)throw Error('NEW_EVIDENCE_PRESENT_DO_NOT_REPLACE');
if(fs.existsSync(file+'.request-lock'))throw Error('REQUEST_LOCK_PRESENT_DO_NOT_RECONCILE');
fs.writeFileSync(file+'.real-calls-suspended',JSON.stringify({reason:'consistency-investigation',recordedAt:Date.now()}),{mode:0o600,flag:'wx'});
const observation={source:'owner-supplied-independent-browser-observation',
 round:20,firstInput:'Estou recebendo um feedback tão indireto que não sei o que concretamente preciso mudar',
 firstResponse:'A falta de concretude transforma o feedback em ruído: você fica sem saber se o problema é real, se já melhorou ou se a mudança que fizer será suficiente. Antes de concluir que você precisa adivinhar, vale examinar se o que foi dito revela um incômodo ainda não nomeado ou se realmente falta especificidade. O que foi dito exatamente?',
 secondInput:'Ela disse que precisa de mais presença e de outro posicionamento, mas não explicou o que isso significa. Foi só isso.',
 secondResult:'unknown',observedMinimumMicroUSD:4289318,observedMinimumCalls:170};
fs.writeFileSync(dir+'/external-observation.json',JSON.stringify(observation,null,2),{mode:0o600,flag:'wx'});
const ledgerBefore=JSON.stringify(state.budget.calls),archivesBefore=JSON.stringify(state.archivedRounds),auditBefore=JSON.stringify(state.audit);
const persistence=createPilotPersistence(file,state);
state.realCallsSuspended=true;
state.budget.observedChargeFloor=Math.max(state.budget.charged,state.budget.observedChargeFloor??0,observation.observedMinimumMicroUSD);
state.budget.observedCallFloor=Math.max(state.budget.calls.reduce((n,c)=>n+(c.callCount??1),0),state.budget.observedCallFloor??0,170);
state.budget.additionalUncertainHoldMicroUSD=Math.max(state.budget.additionalUncertainHoldMicroUSD??0,Math.max(0,state.budget.cap-state.budget.observedChargeFloor));
state.budget.charged=Math.max(state.budget.charged,state.budget.observedChargeFloor+state.budget.additionalUncertainHoldMicroUSD);
state.budget.blocked=true;state.budget.blockReason='Reconciliação: segundo resultado e uso desconhecidos. Toda a margem restante retida; nenhuma chamada real autorizada.';
state.budget.usageDetailIncomplete=true;
const id='external-observation-round20-first';
state.delivery??={};
state.delivery[id]={requestId:id,sessionId:state.session.id,content:observation.firstInput,
 source:'external-observation',status:'completed',result:{text:observation.firstResponse}};
state.delivery['external-observation-round20-second']={requestId:'external-observation-round20-second',sessionId:state.session.id,
 content:observation.secondInput,source:'external-observation',status:'uncertain',code:'RESULT_UNCONFIRMED'};
state.session.exchangeCount=1;state.session.context={messages:[{role:'user',content:observation.firstInput},{role:'assistant',content:observation.firstResponse}]};
state.reconciliations??=[];state.reconciliations.push({kind:'external-observation-recovery',recordedAt:Date.now(),sourceFile:dir+'/external-observation.json',
 originalStateSHA256:sha(before),usageReconstructed:false,originalRequestIdsRecovered:false,classificationRecovered:false,
 secondOutcome:'unknown',observedMinimumMicroUSD:4289318,observedMinimumCalls:170,additionalHoldMicroUSD:state.budget.additionalUncertainHoldMicroUSD});
if(JSON.stringify(state.budget.calls)!==ledgerBefore||JSON.stringify(state.archivedRounds)!==archivesBefore||JSON.stringify(state.audit)!==auditBefore)throw Error('ORIGINAL_EVIDENCE_CHANGED');
persistence.save();
const result={revision:'consistency-2',round:20,realCallsSuspended:true,originalStateSHA256:sha(before),
 reconciledStateSHA256:sha(fs.readFileSync(file)),observedMinimumUSD:state.budget.observedChargeFloor/1e6,
 observedCalls:state.budget.observedCallFloor,additionalUncertainHoldUSD:state.budget.additionalUncertainHoldMicroUSD/1e6,
 deductedIncludingHoldUSD:state.budget.charged/1e6,capUSD:state.budget.cap/1e6,archivesAndLedgerUnchanged:true,
 recoveredFirstResponseSource:observation.source,secondOutcome:'unknown',expiresAt:state.expiresAt};
fs.writeFileSync(dir+'/reconciliation-result.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
