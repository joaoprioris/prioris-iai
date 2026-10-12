'use strict';
// Reference policy. Inputs are semantic observations, not keyword matches.
// trustedContext must come from authenticated server-side state, never user/LLM output.
const AGENTS = Object.freeze(['MNT', 'CTN', 'PRF', 'IMP', 'FBK', 'OTO', 'CRS']);
const JOBS = Object.freeze(['compare_paths', 'close_bilateral', 'prepare_message', 'understand_impact', 'explore_pattern', 'unclear']);
function checkBoolean(object, key) {
  if (object[key] !== undefined && typeof object[key] !== 'boolean') throw new TypeError('Invalid boolean: ' + key);
  return object[key] === true;
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
  const ownImpairment = checkBoolean(analysis, 'ownClarityImpaired');
  const bilateral = checkBoolean(analysis, 'bilateralConversation');
  const decisionClear = checkBoolean(analysis, 'decisionSufficientlyClear');
  const recurrenceReported = checkBoolean(analysis, 'ownRecurrenceReported');
  const authorized = checkBoolean(trustedContext, 'historyAuthorized');
  const corroborated = checkBoolean(trustedContext, 'historyCorroborated');
  const compatible = checkBoolean(trustedContext, 'historyCompatibleWithCurrent');
  const sameOwner = typeof trustedContext.userId === 'string' && trustedContext.userId.length > 0 && trustedContext.userId === trustedContext.memoryOwnerId;
  const sameTenant = typeof trustedContext.organizationId === 'string' && trustedContext.organizationId.length > 0 && trustedContext.organizationId === trustedContext.memoryOrganizationId;
  const historyUsable = authorized && corroborated && compatible && sameOwner && sameTenant;
  const result = (mode, agent, reason, question = null) => Object.freeze({
    version: '0.1.0', mode, agent, reason, question,
    transition: mode === 'agent' && previousAgent !== null && previousAgent !== agent,
    previousAgent, background: mode === 'agent' && historyUsable ? ['EVL'] : [],
    memoryWriteAllowed: false, organizationalScoreAllowed: false,
  });
  if (personalEmergency) return result('human_support', null, 'personal_emergency', 'Há alguém de confiança ou um serviço de apoio humano que possa acompanhar você agora?');
  if (analysis.scope === 'outside') return result('outside_scope', null, 'outside_scope');
  if (externalRisk) {
    if (typeof analysis.riskEvidence !== 'string' || !analysis.riskEvidence.trim()) {
      return result('clarify', null, 'risk_requires_context', 'O que está acontecendo agora e pode piorar se nada for feito?');
    }
    return result('agent', 'CRS', 'immediate_external_risk');
  }
  if (ownImpairment) {
    if(analysis.confidence!=='high')return result('clarify',null,'own_capacity_requires_context','Sua reação está impedindo você de pensar com clareza agora, ou falta entender melhor a situação?');
    return result('agent', 'CTN', 'own_capacity_impaired');
  }
  if (analysis.scope === 'unclear' || analysis.confidence !== 'high' || analysis.job === 'unclear') {
    return result('clarify', null, 'functional_need_unclear', 'Você precisa comparar caminhos, fechar um compromisso, preparar o que dizer ou compreender o impacto?');
  }
  if (analysis.job === 'compare_paths') return result('agent', 'MNT', 'compare_paths');
  if (analysis.job === 'close_bilateral') {
    return bilateral ? result('agent', 'OTO', 'bilateral_commitment') : result('clarify', null, 'bilateral_context_missing', 'Esse fechamento depende de uma conversa com outra pessoa ou de comparar opções antes?');
  }
  if (analysis.job === 'prepare_message') {
    return decisionClear ? result('agent', 'FBK', 'message_preparation') : result('clarify', null, 'decision_target_missing', 'O que você quer comunicar já está definido ou ainda precisa decidir?');
  }
  if (analysis.job === 'understand_impact') return result('agent', 'IMP', 'human_impact');
  if (analysis.job === 'explore_pattern') {
    return recurrenceReported || historyUsable ? result('agent', 'PRF', historyUsable ? 'corroborated_history' : 'user_reported_hypothesis') : result('clarify', null, 'recurrence_not_established', 'Isso se repete em outros contextos ou você quer resolver este episódio?');
  }
  throw new TypeError('Unreachable job');
}
module.exports = { AGENTS, JOBS, decideRoute };
