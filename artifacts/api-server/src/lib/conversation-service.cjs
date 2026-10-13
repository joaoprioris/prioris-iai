'use strict';
const { decideRoute, AGENTS, readSituation, readRisk, ROUTING_VERSION } = require('./functional-policy.cjs');
const {createHash}=require('node:crypto');
const {turnDirective,closingFallback}=require('./conversation-guidance.cjs');
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
  const allowed = ['scope', 'job', 'confidence', 'personalEmergency', 'immediateExternalRisk', 'riskEvidence', 'riskKind', 'riskBasis', 'ownClarityImpaired', 'conversationInProgress', 'decisionSufficientlyClear', 'ownRecurrenceReported', 'situationState', 'stateEvidence'];
  const clean = {};
  for (const k of allowed) if (Object.hasOwn(v, k)) clean[k] = v[k];
  if(clean.riskKind!==undefined&&!['physical','organizational','unclear'].includes(clean.riskKind))throw new ConversationError('INVALID_MODEL_RESPONSE',502);
  decideRoute(clean); // Runtime validation. Never accept trusted/history fields from a model.
  readSituation(clean);
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
      const allMessages=[...currentMessages,{role:'user',content:input.content.trim()}];
      const trusted = { userId: scope.userId, organizationId: scope.organizationId, historyAuthorized: settings.enabled && settings.noticeVersion === NOTICE_VERSION, historyCorroborated: false, historyCompatibleWithCurrent: false,reportedMessages:allMessages };
      const previous = AGENTS.includes(ctx.agentType) ? ctx.agentType : null;
      const route = decideRoute(analysis, trusted, previous);
      // Re-read on every turn; do not inherit a stale state after a correction.
      const situationReading = readSituation(analysis, [...currentMessages, {role:'user',content:input.content.trim()}]);
      const count=session.exchangeCount+1;
      const riskReading=readRisk(analysis,allMessages);
      const turnControl={number:count,max:MAX_EXCHANGES,previousProgress:ctx.progress??null,situationReading,riskReading};
      if(repository.recordObservation)await repository.recordObservation(scope,{sessionId:input.sessionId,requestId:input.requestId,turn:count,inputHash:contentHash,version:ROUTING_VERSION,analysis,riskReading,situationReading,route});
      let text;
      let progress=null;
      if (route.mode === 'clarify') text = count===MAX_EXCHANGES?closingFallback(null,allMessages):route.question;
      else if (route.mode === 'outside_scope') text = count===MAX_EXCHANGES?'Este pedido não foi identificado como uma situação de liderança com impacto humano. Esta conversa se encerra sem uma conclusão sobre ele. Você pode iniciar uma nova conversa trazendo o contexto de liderança em que precisa de apoio.':'O IAí apoia situações de liderança com impacto humano. Se esse pedido estiver ligado a uma situação assim, conte qual é o contexto.';
      else if (route.mode === 'human_support') text = 'Essa situação precisa de apoio humano imediato. Procure alguém de confiança e atendimento adequado para acompanhar você agora.';
      else if (route.agent === 'CRS' && riskReading.kind==='physical' && riskReading.verified) {
       text = 'Priorize sua segurança e a das pessoas envolvidas. Mantenha distância do perigo; não entre em confronto nem tente conter ou separar fisicamente pessoas. Acione os profissionais responsáveis pelo atendimento da ocorrência. Se houver ameaça à integridade física ou perigo imediato, procure segurança ou o serviço de emergência local. Não se exponha para investigar ou recolher relatos agora. '+(count===MAX_EXCHANGES?'O risco relatado continua exigindo apoio humano adequado; não há base para afirmar que foi resolvido. Esta conversa se encerra aqui, mas o atendimento de segurança não deve aguardar uma nova conversa com o IAí.':'Você está em um local seguro e já conseguiu acionar ajuda adequada?');
      }
      else {
        if (typeof agentPrompts[route.agent] !== 'string') throw new ConversationError('AGENT_CONFIGURATION_MISSING', 503);
        const proportionate=riskReading.kind==='physical'&&riskReading.verified?'':'\nNão há base verificada para ameaça física nesta leitura. Não acrescente instruções de afastamento físico, segurança ou emergência física sem relato pertinente. Atualize a ajuda com a correção atual do líder; risco organizacional não é automaticamente emergência física. Preserve a função documentada do agente selecionado. Incerteza não autoriza inventar data, execução, culpa, política ou obrigação.';
        try { const response=await respond({ agent: route.agent, system:agentPrompts[route.agent]+'\n'+turnDirective(turnControl)+proportionate,messages:allMessages,history,turn:turnControl });if(typeof response==='string')text=response;else {text=response.text;progress=response.progress??null;} }
        catch (err) { const invalid=['RESPONSE_CONSTRAINT_FAILED','INCOMPLETE_RESPONSE','INVALID_PROGRESSION','INVALID_PROGRESS_EVIDENCE','INVALID_CLOSURE'].includes(err?.message);throw new ConversationError(invalid?'INVALID_MODEL_RESPONSE':'MODEL_UNAVAILABLE', invalid?502:503); }
      }
      if (typeof text !== 'string' || !text.trim() || text.length > 30000) throw new ConversationError('INVALID_MODEL_RESPONSE', 502);
      const earlyClose = progress?progress.stage==='close':text.trimEnd().endsWith(CLOSE_SIGNAL);
      text = text.replace(/\s*\[ENCERRAR\]\s*$/,'').trim();
      if(count===MAX_EXCHANGES&&progress===null&&text.includes('?'))text=closingFallback(route.agent,allMessages);
      const closing = earlyClose || count >= MAX_EXCHANGES || route.mode === 'human_support';
      const result = { text, exchangeCount: count, maxExchanges: MAX_EXCHANGES, status: closing ? 'closed' : 'active', lowConfidence: route.mode === 'clarify', route: { mode: route.mode, agent: route.agent, transition: route.transition, reason: route.reason }, historyUsed: history.length > 0 };
      const messages = [...currentMessages, { role: 'user', content: input.content.trim() }, { role: 'assistant', content: text }];
      const progressTrail=[...(Array.isArray(ctx.progressTrail)?ctx.progressTrail:[]),{turn:count,agent:route.agent,stage:progress?.stage??route.mode,completed:progress?.completed?.map(c=>c.criterion)??[],pending:progress?.pending??[]}].slice(-MAX_EXCHANGES);
      const context = { messages: closing && !settings.enabled ? [] : messages, agentType: route.agent || previous,progress,progressTrail,situationReading,routingVersion: ROUTING_VERSION, lastRequest: { id: input.requestId, content: input.content.trim(), result } };
      // Disabling history still permits operational context while a conversation is active.
      // Once it closes, retain no conversation text or replay payload in that context.
      const persistedContext = closing && !settings.enabled ? { agentType:context.agentType, routingVersion:context.routingVersion } : context;
      const committed = await repository.commitTurn(scope, { sessionId: input.sessionId, requestId:input.requestId, contentHash, expectedCount: session.exchangeCount, settingsRevision: settings.revision, context:persistedContext, agent: route.agent || previous || 'MNT', status: result.status, nextCount: count,result, privateRecord: settings.enabled ? { sessionId: input.sessionId, input: input.content.trim(), response: text, time: clock().toISOString() } : null });
      if (!committed) throw new ConversationError('CONVERSATION_CHANGED', 409);
      return result;
    } finally { busy.delete(key); }
  }
  return { turn };
}
module.exports = { createConversationService, ConversationError, readAnalysis, NOTICE_VERSION, MAX_EXCHANGES };
