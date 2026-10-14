'use strict';
const { ROUTING_VERSION } = require('./functional-policy.cjs');
const SECOND_IDENTITY = Object.freeze({ id: '00000000-0000-4000-8000-000000000303', organizationId: '00000000-0000-4000-8000-000000000304', organizationName: 'Outra empresa fictícia — rodada 2', email: 'outro-piloto@example.invalid', role: 'leader' });
function prepareSecondRound(original, now = Date.now()) {
  if (original.version === '0.3.1') {
    if (original.round !== 2 || !original.budget || !Array.isArray(original.archivedRounds)) throw Error('PILOT_STATE_MISMATCH');
    return original; // restart never resets either deadline or cumulative budget
  }
  if (original.version !== '0.3.0' || !original.session || original.session.userId !== '00000000-0000-4000-8000-000000000301' || original.session.organizationId !== '00000000-0000-4000-8000-000000000302' || !Number.isSafeInteger(original.budget?.charged) || original.budget.charged < 0 || !Array.isArray(original.budget.calls)) throw Error('PILOT_STATE_MISMATCH');
  const preserved = structuredClone(original);
  return {
    version: '0.3.1', round: 2, provider: original.provider, createdAt: now, expiresAt: now + 2 * 60 * 60 * 1000,
    archivedRounds: [{ round: 1, version: '0.3.0', endedBy: 'abandonment-reported-by-user', classificationEvidence: 'not-recorded', original: preserved }],
    budget: { ...structuredClone(original.budget), currentRound: 2, calls: original.budget.calls.map(c => ({ ...c, round: 1 })) },
    requests: {}, audit: [],
  };
}
const THIRD_IDENTITY = Object.freeze({ id: '00000000-0000-4000-8000-000000000305', organizationId: '00000000-0000-4000-8000-000000000306', organizationName: 'Empresa fictícia independente — rodada 3', email: 'rodada3@example.invalid', role: 'leader' });
function prepareThirdRound(original, now = Date.now()) {
  if (original.version === '0.3.2') {
    if (original.round !== 3 || !original.budget || !Array.isArray(original.archivedRounds)) throw Error('PILOT_STATE_MISMATCH');
    return original;
  }
  if (original.version !== '0.3.1' || original.round !== 2 || original.session?.status !== 'closed' || original.session?.userId !== SECOND_IDENTITY.id || original.session?.organizationId !== SECOND_IDENTITY.organizationId || !Number.isSafeInteger(original.budget?.charged) || original.budget.charged < 0 || !Array.isArray(original.budget.calls) || !Array.isArray(original.archivedRounds)) throw Error('PILOT_STATE_MISMATCH');
  return {
    version: '0.3.2', round: 3, provider: original.provider, createdAt: now, expiresAt: now + 2 * 60 * 60 * 1000,
    archivedRounds: [...structuredClone(original.archivedRounds), { round: 2, version: '0.3.1', endedBy: 'server-closed-at-turn-3', generationEvidence: 'not-recorded', original: structuredClone(original) }],
    budget: { ...structuredClone(original.budget), currentRound: 3 }, requests: {}, audit: [],
  };
}
const FOURTH_IDENTITY = Object.freeze({ id: '00000000-0000-4000-8000-000000000307', organizationId: '00000000-0000-4000-8000-000000000308', organizationName: 'Empresa fictícia independente — rodada 4', email: 'rodada4@example.invalid', role: 'leader' });
function prepareFourthRound(original, now = Date.now()) {
  if (original.version === '0.3.3') {
    if (original.round !== 4 || !original.budget || !Array.isArray(original.archivedRounds)) throw Error('PILOT_STATE_MISMATCH');
    return original;
  }
  if (original.version !== '0.3.2' || original.round !== 3 || original.session?.userId !== THIRD_IDENTITY.id || original.session?.organizationId !== THIRD_IDENTITY.organizationId || !Number.isSafeInteger(original.budget?.charged) || original.budget.charged < 0 || !Array.isArray(original.budget.calls) || !Array.isArray(original.archivedRounds) || original.budget.calls.some(c => c.status === 'reserved')) throw Error('PILOT_STATE_MISMATCH');
  return {
    version: '0.3.3', round: 4, provider: original.provider, createdAt: now, expiresAt: now + 2 * 60 * 60 * 1000,
    archivedRounds: [...structuredClone(original.archivedRounds), { round: 3, version: '0.3.2', endedBy: 'abandonment-reported-by-user', validationCodes: 'not-recorded-originally', original: structuredClone(original) }],
    budget: { ...structuredClone(original.budget), currentRound: 4 }, requests: {}, audit: [],
  };
}
const FIFTH_IDENTITY = Object.freeze({ id: '00000000-0000-4000-8000-000000000309', organizationId: '00000000-0000-4000-8000-000000000310', organizationName: 'Empresa fictícia independente — rodada 5', email: 'rodada5@example.invalid', role: 'leader' });
function prepareFifthRound(original, now = Date.now()) {
  if (original.version === ROUTING_VERSION) {
    if (!Number.isSafeInteger(original.round) || original.round < 5 || !original.budget || !Array.isArray(original.archivedRounds)) throw Error('PILOT_STATE_MISMATCH');
    return original;
  }
  if (original.version !== '0.3.3' || original.round !== 4 || original.session?.userId !== FOURTH_IDENTITY.id || original.session?.organizationId !== FOURTH_IDENTITY.organizationId || !Number.isSafeInteger(original.budget?.charged) || original.budget.charged < 0 || !Array.isArray(original.budget.calls) || !Array.isArray(original.archivedRounds) || original.budget.calls.some(c => c.status === 'reserved')) throw Error('PILOT_STATE_MISMATCH');
  return {
    version: ROUTING_VERSION, round: 5, provider: original.provider, createdAt: now, expiresAt: now + 2 * 60 * 60 * 1000,
    archivedRounds: [...structuredClone(original.archivedRounds), { round: 4, version: '0.3.3', endedBy: 'abandonment-reported-by-user', original: structuredClone(original) }],
    budget: { ...structuredClone(original.budget), currentRound: 5 }, requests: {}, audit: [],
  };
}
module.exports = { prepareSecondRound, SECOND_IDENTITY, prepareThirdRound, THIRD_IDENTITY, prepareFourthRound, FOURTH_IDENTITY, prepareFifthRound, FIFTH_IDENTITY };

function prepareIndependentRound(original, now = Date.now(), endedBy = 'coordinator-ended-test') {
  if (original.version !== ROUTING_VERSION || !Number.isSafeInteger(original.round) || original.round < 5 || !Number.isSafeInteger(original.budget?.charged) || original.budget.charged < 0 || !Array.isArray(original.budget.calls) || !Array.isArray(original.archivedRounds) || original.budget.calls.some(c => c.status === 'reserved')) throw Error('PILOT_STATE_MISMATCH');
  const round = original.round + 1;
  const prior = structuredClone(original);
  // Existing archives remain in the parent array, without recursive copies.
  prior.archivedRounds = [];
  return { version: ROUTING_VERSION, round, provider: original.provider, createdAt: now, expiresAt: now + 2 * 60 * 60 * 1000, archivedRounds: [...structuredClone(original.archivedRounds), { round: original.round, version: original.version, endedBy, original: prior }], budget: { ...structuredClone(original.budget), currentRound: round }, requests: {}, audit: [] };
}
module.exports.prepareIndependentRound = prepareIndependentRound;
