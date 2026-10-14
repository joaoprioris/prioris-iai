'use strict';
const { FIFTH_IDENTITY } = require('./pilot-rounds.cjs');

function pilotIdentity(round) {
  if (round === 5) return FIFTH_IDENTITY;
  return { ...FIFTH_IDENTITY,
    id: '00000000-0000-4000-8000-' + String(299 + 2 * round).padStart(12, '0'),
    organizationId: '00000000-0000-4000-8000-' + String(300 + 2 * round).padStart(12, '0'),
    organizationName: 'Empresa fictícia independente — rodada ' + round,
    email: 'rodada' + round + '@example.invalid' };
}

function advanceBlock(state, inFlight = 0, now = Date.now()) {
  if (now >= state.expiresAt) return 'PILOT_EXPIRED';
  if (inFlight) return 'TURN_IN_PROGRESS';
  if (state.budget?.blocked || !Array.isArray(state.budget?.calls) ||
      state.budget.calls.some(c => !['accounted', 'observed-summary-held'].includes(c.status)))
    return 'BUDGET_PENDING';
  if (state.session?.status !== 'closed') return 'SESSION_NOT_CLOSED';
  return null;
}

function abandonBlock(state, inFlight = 0, now = Date.now()) {
  if (now >= state.expiresAt) return 'PILOT_EXPIRED';
  if (inFlight || state.budget?.calls?.some(c => c.status === 'reserved'))
    return 'TURN_IN_PROGRESS';
  if (state.session?.status !== 'active') return 'SESSION_NOT_ACTIVE';
  return null;
}

function abandonPilotConversation(state, { expectedRound, sessionId, reason = '', inFlight = 0, now = Date.now() }, save) {
  if (!Number.isSafeInteger(expectedRound) || expectedRound !== state.round ||
      typeof sessionId !== 'string' || sessionId !== state.session?.id)
    throw Error('ROUND_CHANGED');
  if (typeof reason !== 'string' || reason.length > 2000) throw Error('INVALID_REASON');
  if (now >= state.expiresAt) throw Error('PILOT_EXPIRED');
  if (inFlight || state.budget?.calls?.some(c => c.status === 'reserved'))
    throw Error('TURN_IN_PROGRESS');
  if (state.session.status === 'closed' && state.abandonment?.kind === 'abandonment')
    return state.abandonment; // Same action never adds a second audit event.
  const blocked = abandonBlock(state, inFlight, now);
  if (blocked) throw Error(blocked);
  const session = state.session, audit = state.audit, previous = state.abandonment;
  const abandonment = {
    kind: 'abandonment', approval: false, at: now, reason,
    recordedBy: 'authenticated-owner',
  };
  state.session = { ...session, status: 'closed' };
  state.abandonment = abandonment;
  state.audit = [...audit, {
    ...abandonment,
    kind: 'owner_abandonment', outcome: 'abandoned', round: state.round,
    sessionId,
  }];
  try { save(); }
  catch (error) {
    state.session = session;
    state.audit = audit;
    if (previous === undefined) delete state.abandonment;
    else state.abandonment = previous;
    throw error;
  }
  return abandonment;
}

// Synchronous persistence makes competing clicks see either the old closed
// round or the new empty round, never a partially archived conversation.
function advancePilotRound(state, { expectedRound, sessionId, inFlight = 0, now = Date.now() }, save) {
  if (!Number.isSafeInteger(expectedRound) || expectedRound !== state.round ||
      typeof sessionId !== 'string' || sessionId !== state.session?.id)
    throw Error('ROUND_CHANGED');
  const blocked = advanceBlock(state, inFlight, now);
  if (blocked) throw Error(blocked);
  const prior = structuredClone(state);
  prior.archivedRounds = []; // Previous archives stay intact in the parent.
  const original = { ...state };
  const previousBudgetRound = state.budget.currentRound;
  state.archivedRounds = [...state.archivedRounds, {
    round: state.round, version: state.version,
    endedBy: state.abandonment?.kind === 'abandonment' ? 'owner-abandonment' : 'owner-next-conversation',
    original: prior,
  }];
  state.round += 1;
  state.createdAt = now;
  state.budget.currentRound = state.round; // Keep the budget object/ledger alive.
  state.requests = {};
  state.audit = [];
  delete state.session;
  delete state.abandonment;
  try { save(); }
  catch (error) {
    Object.assign(state, original);
    state.budget.currentRound = previousBudgetRound;
    throw error;
  }
  return { round: state.round, expiresAt: state.expiresAt };
}

module.exports = { pilotIdentity, advanceBlock, advancePilotRound, abandonBlock, abandonPilotConversation };
