'use strict';
const { decideRoute, AGENTS } = require('./functional-policy.cjs');
const {createHash}=require('node:crypto');
const MAX_EXCHANGES = 10;
const NOTICE_VERSION = 'history-v1-20261012';
const CLOSE_SIGNAL = '[ENCERRAR]';
class ConversationError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
function requireScope(scope) {
  if (!scope || typeof scope.userId !== 'string' || !scope.userId || typeof scope.organizationId !== 'string' || !scope.organizationId) throw new ConversationError('AUTH_REQUIRED', 401);
}
function readAnalysis(value) {
  const v = typeof value === 'string' ? JSON.parse(value.trim().replace(/^```(?:json)?\s*|\s*```$/g, '').trim()) : value;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ConversationError('INVALID_MODEL_RESPONSE', 502);
  const allowed = ['scope', 'job', 'confidence', 'personalEmergency', 'immediateExternalRisk', 'riskEvidence', 'ownClarityImpaired', 'bilateralConversation', 'decisionSufficientlyClear', 'ownRecurrenceReported'];
  const clean = {};
  for (const k of allowed) if (Object.hasOwn(v, k)) clean[k] = v[k];
  decideRoute(clean); // Runtime validation. Never accept trusted/history fields from a model.
  return clean;
}
function createConversationService({ repository, classify, respond, agentPrompts, clock = () => new Date() }) {
  const busy = new Set();
  async function turn(scope, input) {
    requireScope(scope);
    scope = Object.freeze({userId:scope.userId,organizationId:scope.organizationId});
    if (!input || typeof input.sessionId !== 'string' || typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId) || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 8000) throw new ConversationError('INVALID_INPUT', 400);
    const key = scope.organizationId + ':' + scope.userId + ':' + input.sessionId;
    if (busy.has(key)) throw new ConversationError('TURN_IN_PROGRESS', 409);
    busy.add(key);
    try {
      const session = await repository.getSession(scope, input.sessionId);
      if (!session) throw new ConversationError('SESSION_NOT_FOUND', 404);
      const ctx = session.context || {};
      if (ctx.lastRequest && ctx.lastRequest.id === input.requestId) {
        if (ctx.lastRequest.content !== input.content.trim()) throw new ConversationError('IDEMPOTENCY_CONFLICT', 409);
        return { ...ctx.lastRequest.result, replayed: true };
      }
      const contentHash=createHash('sha256').update(input.content.trim()).digest('hex');
      if(repository.getCompletedRequest){
        const completed=await repository.getCompletedRequest(scope,input.sessionId,input.requestId);
        if(completed)throw new ConversationError(completed.contentHash===contentHash?'REQUEST_ALREADY_COMPLETED':'IDEMPOTENCY_CONFLICT',409);
      }
      if (session.status !== 'active' || session.exchangeCount >= MAX_EXCHANGES) throw new ConversationError('SESSION_CLOSED', 400);
      const fetchedSettings = await repository.getHistorySettings(scope);
      const settings = Object.freeze({...fetchedSettings,enabled:fetchedSettings.enabled===true&&fetchedSettings.noticeVersion===NOTICE_VERSION});
      const history = settings.enabled && settings.noticeVersion === NOTICE_VERSION ? await repository.readPrivateHistory(scope, 4, input.sessionId) : [];
      const currentMessages = Array.isArray(ctx.messages) ? ctx.messages : [];
      let analysis;
      try { analysis = readAnalysis(await classify({ messages: [...currentMessages, { role: 'user', content: input.content.trim() }], history, previousAgent: ctx.agentType || null })); }
      catch (err) { throw new ConversationError(err.code === 'INVALID_MODEL_RESPONSE' || err instanceof TypeError || err instanceof SyntaxError ? 'INVALID_MODEL_RESPONSE' : 'MODEL_UNAVAILABLE', err.code === 'INVALID_MODEL_RESPONSE' || err instanceof TypeError || err instanceof SyntaxError ? 502 : 503); }
      // Stored history can give context, but is not automatically a verified pattern.
      const trusted = { userId: scope.userId, organizationId: scope.organizationId, historyAuthorized: settings.enabled && settings.noticeVersion === NOTICE_VERSION, historyCorroborated: false, historyCompatibleWithCurrent: false };
      const previous = AGENTS.includes(ctx.agentType) ? ctx.agentType : null;
      const route = decideRoute(analysis, trusted, previous);
      let text;
      if (route.mode === 'clarify') text = route.question;
      else if (route.mode === 'outside_scope') text = 'O IAí apoia situações de liderança com impacto humano. Se esse pedido estiver ligado a uma situação assim, conte qual é o contexto.';
      else if (route.mode === 'human_support') text = 'Essa situação precisa de apoio humano imediato. Procure alguém de confiança e atendimento adequado para acompanhar você agora.';
      else if (route.agent === 'CRS') text = 'Priorize sua segurança e a das pessoas envolvidas. Mantenha distância do perigo; não entre em confronto nem tente conter ou separar fisicamente pessoas. Acione os profissionais responsáveis pelo atendimento da ocorrência. Se houver ameaça à integridade física ou perigo imediato, procure segurança ou o serviço de emergência local. Não se exponha para investigar ou recolher relatos agora. Você está em um local seguro e já conseguiu acionar ajuda adequada?';
      else {
        if (typeof agentPrompts[route.agent] !== 'string') throw new ConversationError('AGENT_CONFIGURATION_MISSING', 503);
        try { text = await respond({ agent: route.agent, system: agentPrompts[route.agent], messages: [...currentMessages, { role: 'user', content: input.content.trim() }], history }); }
        catch (err) { const invalid=['RESPONSE_CONSTRAINT_FAILED','INCOMPLETE_RESPONSE'].includes(err?.message);throw new ConversationError(invalid?'INVALID_MODEL_RESPONSE':'MODEL_UNAVAILABLE', invalid?502:503); }
      }
      if (typeof text !== 'string' || !text.trim() || text.length > 30000) throw new ConversationError('INVALID_MODEL_RESPONSE', 502);
      const earlyClose = text.trimEnd().endsWith(CLOSE_SIGNAL);
      text = text.replace(/\s*\[ENCERRAR\]\s*$/,'').trim();
      const count = session.exchangeCount + 1;
      const closing = earlyClose || count >= MAX_EXCHANGES || route.mode === 'human_support';
      const result = { text, exchangeCount: count, maxExchanges: MAX_EXCHANGES, status: closing ? 'closed' : 'active', lowConfidence: route.mode === 'clarify', route: { mode: route.mode, agent: route.agent, transition: route.transition, reason: route.reason }, historyUsed: history.length > 0 };
      const messages = [...currentMessages, { role: 'user', content: input.content.trim() }, { role: 'assistant', content: text }];
      const context = { messages: closing && !settings.enabled ? [] : messages, agentType: route.agent || previous, routingVersion: '0.1.0', lastRequest: { id: input.requestId, content: input.content.trim(), result } };
      // Disabling history still permits operational context while a conversation is active.
      // Once it closes, retain no conversation text or replay payload in that context.
      const persistedContext = closing && !settings.enabled ? { agentType:context.agentType, routingVersion:context.routingVersion } : context;
      const committed = await repository.commitTurn(scope, { sessionId: input.sessionId, requestId:input.requestId, contentHash, expectedCount: session.exchangeCount, settingsRevision: settings.revision, context:persistedContext, agent: route.agent || previous || 'MNT', status: result.status, nextCount: count, privateRecord: settings.enabled ? { sessionId: input.sessionId, input: input.content.trim(), response: text, time: clock().toISOString() } : null });
      if (!committed) throw new ConversationError('CONVERSATION_CHANGED', 409);
      return result;
    } finally { busy.delete(key); }
  }
  return { turn };
}
module.exports = { createConversationService, ConversationError, readAnalysis, NOTICE_VERSION, MAX_EXCHANGES };
