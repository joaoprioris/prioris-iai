'use strict';
// Reference policy. Inputs are semantic observations, not keyword matches.
// trustedContext must come from authenticated server-side state, never user/LLM output.
const AGENTS = Object.freeze(['MNT', 'CTN', 'PRF', 'IMP', 'FBK', 'OTO', 'CRS']);
const ROUTING_VERSION = '0.3.4-EX05-1';
const {references,readFunctionalNeed,focalQuestion}=require('./functional-context.cjs');
const JOBS = Object.freeze(['compare_paths', 'conduct_live', 'prepare_message', 'understand_impact', 'explore_pattern', 'analyze_crisis', 'unclear']);
const SITUATION_STATES = Object.freeze(['BEFORE', 'DURING', 'AFTER', 'PATTERN', 'EMPTY']);
// A state is an internal reading, never an agent or evidence of incapacity.
function readSituation(analysis, messages = []) {
  if (analysis.situationState != null && !SITUATION_STATES.includes(analysis.situationState)) throw new TypeError('Invalid situation state');
  if (analysis.stateEvidence !== undefined && typeof analysis.stateEvidence !== 'string') throw new TypeError('Invalid state evidence');
  const evidence = analysis.stateEvidence?.trim();
  if(analysis.stateReferences!==undefined&&!Array.isArray(analysis.stateReferences))throw new TypeError('Invalid state references');
  if(analysis.stateReferences?.length){
    const refs=references(analysis.stateReferences,messages);
    return refs.length===analysis.stateReferences.length&&analysis.situationState!=null
      ?Object.freeze({state:analysis.situationState,evidence:refs[0].quote,references:refs})
      :Object.freeze({state:null,evidence:null});
  }
  const grounded = evidence && messages.some(m => m.role === 'user' && typeof m.content === 'string' && m.content.includes(evidence));
  return grounded && analysis.situationState != null
    ? Object.freeze({ state: analysis.situationState, evidence })
    : Object.freeze({ state: null, evidence: null });
}
function checkBoolean(object, key) {
  if (object[key] !== undefined && typeof object[key] !== 'boolean') throw new TypeError('Invalid boolean: ' + key);
  return object[key] === true;
}
function readRisk(analysis, messages = []) {
  const bases=['concrete_immediate_threat_or_harm','uncertainty_only','insufficient'];
  if(analysis.riskBasis!==undefined&&!bases.includes(analysis.riskBasis))throw new TypeError('Invalid risk basis');
  if(analysis.riskEvidence!==undefined&&typeof analysis.riskEvidence!=='string')throw new TypeError('Invalid risk evidence');
  if(analysis.riskImpactEvidence!==undefined&&typeof analysis.riskImpactEvidence!=='string')throw new TypeError('Invalid risk impact evidence');
  if(analysis.riskKind!==undefined&&!['physical','organizational','unclear'].includes(analysis.riskKind))throw new TypeError('Invalid risk kind');
  const evidence=analysis.riskEvidence?.trim()??'';
  // A previous quote cannot by itself establish that the threat is still
  // present after a correction. Require grounding in the current user turn.
  const current=messages.filter(m=>m.role==='user').at(-1);
  const grounded=Boolean(evidence&&typeof current?.content==='string'&&current.content.includes(evidence));
  const impact=analysis.riskImpactEvidence?.trim()??'';
  const impactGrounded=Boolean(impact&&typeof current?.content==='string'&&current.content.includes(impact));
  // "verified" means qualifier + quoted source, not proof of semantic accuracy
  // or independent verification that harm exists.
  return Object.freeze({
    verified:analysis.immediateExternalRisk===true&&analysis.riskBasis==='concrete_immediate_threat_or_harm'&&grounded&&impactGrounded,
    kind:analysis.riskKind??'unclear',basis:analysis.riskBasis??'insufficient',evidence:grounded?evidence:null,
    impactEvidence:impactGrounded?impact:null,
  });
}
function decideRoute(analysis, trustedContext = {}, previousAgent = null) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) throw new TypeError('Invalid analysis');
  if (!trustedContext || typeof trustedContext !== 'object' || Array.isArray(trustedContext)) throw new TypeError('Invalid trusted context');
  if (!['leadership', 'outside', 'unclear'].includes(analysis.scope)) throw new TypeError('Invalid scope');
  if (!JOBS.includes(analysis.job)) throw new TypeError('Invalid job');
  if (!['high', 'moderate', 'low'].includes(analysis.confidence)) throw new TypeError('Invalid confidence');
  if (previousAgent !== null && !AGENTS.includes(previousAgent)) throw new TypeError('Invalid previous agent');
  const personalEmergency = checkBoolean(analysis, 'personalEmergency');
  const externalRisk = checkBoolean(analysis, 'immediateExternalRisk');
  const riskReading = readRisk(analysis, trustedContext.reportedMessages ?? []);
  const impairmentFlag = checkBoolean(analysis, 'ownClarityImpaired');
  if(analysis.ownClarityEvidence!==undefined&&typeof analysis.ownClarityEvidence!=='string')throw new TypeError('Invalid clarity evidence');
  if(analysis.ownClarityBasis!==undefined&&!['reaction_or_overload_impeding_judgment','uncertainty_only','insufficient'].includes(analysis.ownClarityBasis))throw new TypeError('Invalid clarity basis');
  const current=(trustedContext.reportedMessages??[]).filter(m=>m.role==='user').at(-1);
  const ownEvidence=analysis.ownClarityEvidence?.trim();
  const ownImpairment=impairmentFlag&&analysis.ownClarityBasis==='reaction_or_overload_impeding_judgment'&&Boolean(ownEvidence&&current?.content?.includes(ownEvidence));
  const live = checkBoolean(analysis, 'conversationInProgress');
  checkBoolean(analysis, 'decisionSufficientlyClear');
  checkBoolean(analysis,'substantiveDecisionPending');
  for(const key of ['needEvidence','decisionEvidence'])if(analysis[key]!==undefined&&!Array.isArray(analysis[key]))throw new TypeError('Invalid '+key);
  if(analysis.clarificationQuestion!==undefined&&typeof analysis.clarificationQuestion!=='string')throw new TypeError('Invalid clarification question');
  const messages=trustedContext.reportedMessages??[];
  const need=readFunctionalNeed(analysis,messages,trustedContext.functionalNeed);
  if(analysis.crisisPhase!==undefined&&!['BEFORE','DURING','AFTER',null].includes(analysis.crisisPhase))throw new TypeError('Invalid crisis phase');
  if(analysis.crisisEvidence!==undefined&&!Array.isArray(analysis.crisisEvidence))throw new TypeError('Invalid crisis evidence');
  const crisisSources=references(analysis.crisisEvidence,messages);
  const currentIndex=messages.filter(m=>m.role==='user').length-1;
  const currentCrisis=crisisSources.length>0&&crisisSources.some(r=>r.message===currentIndex);
  const question=(fallback)=>focalQuestion(need.clarificationQuestion,fallback,messages);
  const recurrenceReported = checkBoolean(analysis, 'ownRecurrenceReported');
  const authorized = checkBoolean(trustedContext, 'historyAuthorized');
  const corroborated = checkBoolean(trustedContext, 'historyCorroborated');
  const compatible = checkBoolean(trustedContext, 'historyCompatibleWithCurrent');
  const sameOwner = typeof trustedContext.userId === 'string' && trustedContext.userId.length > 0 && trustedContext.userId === trustedContext.memoryOwnerId;
  const sameTenant = typeof trustedContext.organizationId === 'string' && trustedContext.organizationId.length > 0 && trustedContext.organizationId === trustedContext.memoryOrganizationId;
  const historyUsable = authorized && corroborated && compatible && sameOwner && sameTenant;
  const result = (mode, agent, reason, question = null) => Object.freeze({
    version: ROUTING_VERSION, mode, agent, reason, question,
    transition: mode === 'agent' && previousAgent !== null && previousAgent !== agent,
    previousAgent, background: [],
    memoryWriteAllowed: false, organizationalScoreAllowed: false,
  });
  if (personalEmergency) return result('human_support', null, 'personal_emergency', 'Há alguém de confiança ou um serviço de apoio humano que possa acompanhar você agora?');
  if (analysis.scope === 'outside') return result('outside_scope', null, 'outside_scope');
  if (externalRisk && riskReading.verified) {
    return result('agent', 'CRS', 'immediate_external_risk');
  }
  if (ownImpairment) {
    if(analysis.confidence!=='high')return result('clarify',null,'own_capacity_requires_context','Sua reação está impedindo você de pensar com clareza agora, ou falta entender melhor a situação?');
    return result('agent', 'CTN', 'own_capacity_impaired');
  }
  if (analysis.scope === 'unclear' || need.confidence==='low' || (need.confidence==='moderate'&&!need.grounded) || need.job === 'unclear') {
    return result('clarify', null, 'functional_need_unclear', question('Qual dúvida concreta desta situação ainda precisa ser trabalhada?'));
  }
  if (need.job === 'compare_paths') return result('agent', 'MNT', 'compare_paths');
  if (need.job === 'analyze_crisis') return currentCrisis && analysis.crisisPhase
    ? result('agent','CRS','contextualized_crisis_analysis')
    : result('clarify',null,'crisis_context_missing',question('Quais riscos ou consequências desta situação ainda precisam ser organizados?'));
  if (need.job === 'conduct_live') {
    return live ? result('agent', 'OTO', 'live_conversation_guidance') : result('clarify', null, 'live_context_missing', question('A conversa está acontecendo agora ou você está preparando o que dizer para depois?'));
  }
  if (need.job === 'prepare_message') {
    return need.substantiveDecisionPending
      ?result('clarify',null,'substantive_decision_pending',question('Qual decisão sobre o que fazer ainda está em aberto?'))
      :result('agent','FBK',need.inherited?'message_preparation_context_preserved':'message_preparation');
  }
  if (need.job === 'understand_impact') return result('agent', 'IMP', 'human_impact');
  if (need.job === 'explore_pattern') {
    return recurrenceReported || historyUsable ? result('agent', 'PRF', historyUsable ? 'corroborated_history' : 'user_reported_hypothesis') : result('clarify', null, 'recurrence_not_established', 'Isso se repete em outros contextos ou você quer resolver este episódio?');
  }
  throw new TypeError('Unreachable job');
}
module.exports = { AGENTS, JOBS, decideRoute, readSituation, readRisk, SITUATION_STATES, ROUTING_VERSION };
