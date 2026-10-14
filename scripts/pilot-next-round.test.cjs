'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pilotIdentity, advancePilotRound, advanceBlock } = require('../artifacts/api-server/src/lib/pilot-next-round.cjs');
const { createPilotStore } = require('../artifacts/api-server/src/lib/pilot-store.cjs');
const { createPilotBudget } = require('../artifacts/api-server/src/lib/pilot-budget.cjs');
const sid = '00000000-0000-4000-8000-000000000999';
function fixture() {
  const identity = pilotIdentity(17);
  return { version: '0.3.4', provider: 'replit', round: 17,
    createdAt: Date.now(), expiresAt: Date.now() + 7200000,
    archivedRounds: [{ round: 16, original: { audit: ['fictional-preserved'] } }],
    budget: { cap: 5000000, charged: 20000, currentRound: 17, blocked: false,
      recoveryHoldMicroUSD: 1200, usageDetailIncomplete: true,
      calls: [{ round: 17, status: 'accounted', estimatedMicroUSD: 20000 }] },
    audit: [{ turn: 1, result: { text: 'Conteúdo fictício preservado.' } }],
    requests: { fictitious: { contentHash: 'fixture' } },
    session: { id: sid, userId: identity.id, organizationId: identity.organizationId,
      status: 'closed', exchangeCount: 6, context: { messages: [{ role: 'user', content: 'Fictício.' }] } } };
}
const request = { expectedRound: 17, sessionId: sid };

test('Avança uma vez, arquiva tudo, mantém janela, ledger e reservas conservadoras', () => {
  const s = fixture(), before = structuredClone(s), ledger = s.budget.calls;
  const budget = createPilotBudget(s.budget);
  let saves = 0;
  advancePilotRound(s, request, () => { saves++; });
  assert.equal(saves, 1); assert.equal(s.round, 18);
  assert.equal(s.expiresAt, before.expiresAt);
  assert.equal(s.budget.calls, ledger);
  assert.deepEqual({ ...s.budget, currentRound: 17 }, before.budget);
  assert.equal(budget.snapshot().estimatedUSD, .020000);
  assert.deepEqual(s.archivedRounds[0], before.archivedRounds[0]);
  assert.deepEqual(s.archivedRounds[1].original, { ...before, archivedRounds: [] });
  assert.deepEqual(s.audit, []); assert.deepEqual(s.requests, {}); assert.equal(s.session, undefined);
  assert.throws(() => advancePilotRound(s, request, () => { saves++; }), /ROUND_CHANGED/);
  assert.equal(saves, 1); assert.equal(s.round, 18);
});

test('Sessão ativa, envio, expiração, orçamento pendente e token obsoleto bloqueiam sem escrita', () => {
  for (const [change, code, extra] of [
    [s => { s.session.status = 'active'; }, 'SESSION_NOT_CLOSED'],
    [() => {}, 'TURN_IN_PROGRESS', { inFlight: 1 }],
    [s => { s.expiresAt = 1; }, 'PILOT_EXPIRED'],
    [s => { s.budget.calls.push({ status: 'reserved' }); }, 'BUDGET_PENDING'],
    [s => { s.budget.calls.push({ status: 'uncertain-held' }); }, 'BUDGET_PENDING'],
    [s => { s.budget.calls.push({ status: 'unknown-usage-held' }); }, 'BUDGET_PENDING'],
    [s => { s.budget.blocked = true; }, 'BUDGET_PENDING'],
    [s => { s.session.id = 'another'; }, 'ROUND_CHANGED'],
  ]) {
    const s = fixture(); change(s); const before = structuredClone(s);
    assert.throws(() => advancePilotRound(s, { ...request, ...extra }, () => assert.fail('Unexpected write')), new RegExp(code));
    assert.deepEqual(s, before);
  }
});

test('Falha de gravação não altera estado nem orçamento em memória', () => {
  const s = fixture(), before = structuredClone(s);
  assert.throws(() => advancePilotRound(s, request, () => { throw Error('FICTITIOUS_STORAGE_FAILURE'); }), /STORAGE_FAILURE/);
  assert.deepEqual(s, before);
});

test('Identidades e históricos isolados; primeira sessão nova começa em zero e sem histórico pessoal', async () => {
  const s = fixture(), old = pilotIdentity(17);
  advancePilotRound(s, request, () => {});
  const identity = pilotIdentity(18);
  assert.notEqual(old.id, identity.id); assert.notEqual(old.organizationId, identity.organizationId);
  const store = createPilotStore(s, () => {}, identity);
  const session = store.open({ userId: identity.id, organizationId: identity.organizationId });
  assert.equal(session.exchangeCount, 0); assert.deepEqual(session.messages, []);
  assert.throws(() => store.open({ userId: old.id, organizationId: old.organizationId }), /SCOPE_DENIED/);
  assert.equal(advanceBlock(s), 'SESSION_NOT_CLOSED');
  const source = readFileSync('artifacts/api-server/src/lib/conversation-service.cjs', 'utf8');
  assert.match(source, /MAX_EXCHANGES\s*=\s*10/);
});

test('HTTP isolado: proprietário/origem, replay e sessão nova sem reinício, sem chamada ao provedor', async () => {
  const Module = require('node:module');
  const requireApi = Module.createRequire(path.resolve('artifacts/api-server/package.json'));
  const { build } = requireApi('esbuild');
  const compiled = await build({ entryPoints: ['artifacts/api-server/src/routes/pilot.ts'],
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    alias: { '@workspace/db': path.resolve('scripts/db-denied-fixture.ts') } });
  const m = new Module(path.resolve('artifacts/api-server/fixture-next-pilot.cjs'), module);
  m.filename = path.resolve('artifacts/api-server/fixture-next-pilot.cjs');
  m.paths = Module._nodeModulePaths(path.dirname(m.filename));
  m._compile(compiled.outputFiles[0].text, m.filename);
  process.env.NODE_ENV = 'development';
  process.env.REPL_OWNER_ID = 'owner-fixture-only'; process.env.REPL_ID = 'repl-fixture-only';
  process.env.REPLIT_DEV_DOMAIN = 'pilot.example.invalid'; process.env.PRIORIS_AI_PROVIDER = 'replit';
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = 'fixture-not-a-credential';
  process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = 'https://provider.example.invalid';
  let subject = 'other-fixture';
  const auth = { discovery: async () => ({}), randomPKCECodeVerifier: () => 'verifier-fixture',
    randomNonce: () => 'nonce-fixture', randomState: () => 'state-fixture',
    calculatePKCECodeChallenge: async () => 'challenge-fixture',
    buildAuthorizationUrl: () => new URL('https://auth.example.invalid/login'),
    authorizationCodeGrant: async (_config, url, checks) => {
      assert.equal(checks.pkceCodeVerifier, 'verifier-fixture');
      assert.equal(checks.expectedNonce, 'nonce-fixture');
      assert.equal(url.searchParams.get('state'), checks.expectedState);
      return { claims: () => ({ sub: subject }) };
    } };
  const dir = mkdtempSync(path.join(tmpdir(), 'iai-isolated-next-'));
  const file = path.join(dir, 'state.json'); writeFileSync(file, JSON.stringify(fixture()));
  const express = requireApi('express'), app = express(); app.use(express.json());
  app.use(requireApi('cookie-parser')());
  let calls = 0;
  app.use('/api/pilot-0.3.0', m.exports.createPilotRouter({ stateFile: file, oidcClient: auth,
    client: { messages: { create: async () => { calls++; throw Error('AI_MUST_NOT_BE_CALLED'); } } } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/pilot-0.3.0`;
  const cookie = r => r.headers.getSetCookie().map(c => c.split(';')[0])
    .filter(c => !c.endsWith('=')).join('; ');
  const fetchLocal = (url, options = {}) => fetch(base + url, { redirect: 'manual', ...options });
  const origin = 'https://pilot.example.invalid';
  const body = JSON.stringify({ round: 17, sessionId: sid });
  try {
    assert.equal((await fetchLocal('/next-conversation', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body })).status, 401);
    let flow = cookie(await fetchLocal('/login', { method: 'POST', headers: { Origin: origin } }));
    assert.equal((await fetchLocal('/callback?state=state-fixture&code=fixture', { headers: { cookie: flow } })).status, 403);
    subject = 'owner-fixture-only';
    flow = cookie(await fetchLocal('/login', { method: 'POST', headers: { Origin: origin } }));
    const owner = cookie(await fetchLocal('/callback?state=state-fixture&code=fixture', { headers: { cookie: flow } }));
    const headers = { cookie: owner, Origin: origin, 'Content-Type': 'application/json' };
    assert.equal((await fetchLocal('/next-conversation', { method: 'POST', headers: { ...headers, Origin: 'https://wrong.example.invalid' }, body })).status, 403);
    const before = JSON.parse(readFileSync(file, 'utf8'));
    const beforeBytes = readFileSync(file, 'utf8');
    // Simulate a filesystem failure only inside this disposable fixture.
    const snapshotDir = path.join(dir, 'snapshots');
    rmSync(snapshotDir, { recursive: true, force: true });
    writeFileSync(snapshotDir, 'Fictitious obstruction');
    assert.equal((await fetchLocal('/next-conversation', { method: 'POST', headers, body })).status, 503);
    assert.equal(readFileSync(file, 'utf8'), beforeBytes);
    assert.equal((await (await fetchLocal('/status', { headers })).json()).round, 17);
    rmSync(snapshotDir);
    const responses = await Promise.all([1, 2].map(() => fetchLocal('/next-conversation', { method: 'POST', headers, body })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const status = await (await fetchLocal('/status', { headers })).json();
    assert.equal(status.round, 18); assert.equal(status.authenticated, true);
    assert.equal(status.nextConversation.allowed, false);
    const after = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(after.expiresAt, before.expiresAt);
    assert.deepEqual({ ...after.budget, currentRound: 17 }, before.budget);
    assert.deepEqual(after.archivedRounds.at(-1).original.audit, before.audit);
    const session = await (await fetchLocal('/sessions', { method: 'POST', headers })).json();
    assert.equal(session.exchangeCount, 0); assert.deepEqual(session.messages, []);
    assert.equal(session.userId, pilotIdentity(18).id);
    assert.equal((await fetchLocal('/next-conversation', { method: 'POST', headers,
      body: JSON.stringify({ round: 18, sessionId: session.id }) })).status, 409);
    assert.equal(calls, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
