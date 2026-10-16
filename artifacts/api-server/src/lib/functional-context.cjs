'use strict';
// Source checks are structural, not proof of the model's semantic interpretation.
function references(value,messages){
 if(!Array.isArray(value)||value.length>4)return [];
 const users=messages.filter(m=>m.role==='user');
 if(!value.every(r=>r&&Number.isInteger(r.message)&&r.message>=0&&typeof r.quote==='string'&&r.quote.trim().length>=5&&r.quote.length<=480&&users[r.message]?.content?.includes(r.quote)))return [];
 return value.map(r=>({message:r.message,quote:r.quote}));
}
function readFunctionalNeed(a,messages=[],previous=null){
 const source=references(a.needEvidence,messages);
 const prior=previous&&references(previous.evidence,messages);
 const priorUsable=a.scope==='leadership'&&prior?.length&&previous.established!==false&&(previous.confidence==='high'||previous.grounded===true)&&previous.job!=='unclear';
 // A grounded new observation can change the need at moderate confidence.
 // Unanchored oscillation must not erase an already explicit need.
 const compatible=previous&&(a.job===previous.job||a.job==='unclear'||a.confidence==='moderate');
 const inherited=Boolean(priorUsable&&compatible&&!source.length);
 const job=inherited?previous.job:a.job;
 const confidence=inherited?previous.confidence:a.confidence;
 const current=messages.filter(m=>m.role==='user').at(-1);
 const legacy=confidence==='high'&&job!=='unclear'&&current
  ?[{message:messages.filter(m=>m.role==='user').length-1,quote:current.content.slice(0,480)}]:[];
 const evidence=inherited?prior:(source.length?source:(priorUsable&&job===previous.job?prior:legacy));
 const decisionEvidence=references(a.decisionEvidence,messages);
 // Confidence does not validate contradictory flags or absent source references.
 // A literal reference is structural grounding, not semantic proof of a choice.
 const pending=Boolean(job==='prepare_message'&&a.decisionSufficientlyClear===false&&
  a.substantiveDecisionPending===true&&source.length&&decisionEvidence.length);
 const inheritedPending=Boolean(inherited&&job==='prepare_message'&&
  previous.substantiveDecisionPending===true&&previous.decisionSufficientlyClear===false&&
  references(previous.decisionEvidence,messages).length&&a.decisionSufficientlyClear!==true&&
  a.substantiveDecisionPending!==false);
 const pendingRejection=a.substantiveDecisionPending===true&&!pending&&!inheritedPending
  ?a.decisionSufficientlyClear===true?'decision_already_clear':!source.length?'need_evidence_invalid':!decisionEvidence.length?'decision_evidence_invalid':'decision_not_confirmed_unclear'
  :null;
 return {job,confidence,evidence,inherited,substantiveDecisionPending:pending||inheritedPending,
  decisionSufficientlyClear:inheritedPending?false:a.decisionSufficientlyClear,
  ...(pendingRejection?{pendingRejection}:{}),
  decisionEvidence:inheritedPending?references(previous.decisionEvidence,messages):decisionEvidence,
  grounded:source.length>0||inherited,
  established:a.scope==='leadership'&&job!=='unclear'&&(confidence==='high'||(confidence==='moderate'&&(source.length>0||inherited)))&&(job!=='conduct_live'||a.conversationInProgress===true),
  clarificationQuestion:typeof a.clarificationQuestion==='string'?a.clarificationQuestion.trim():''};
}
function focalQuestion(proposed,fallback,messages=[]){
 const valid=proposed&&proposed.length<=280&&(proposed.match(/\?/g)||[]).length===1;
 const question=valid?proposed:fallback;
 const asked=messages.filter(m=>m.role==='assistant').some(m=>m.content.trim()===question);
 return asked?'Já perguntei sobre esse ponto. Qual dúvida concreta ainda ficou sem resposta para você?':question;
}
module.exports={references,readFunctionalNeed,focalQuestion};
