'use strict';
// Run from an assembled application root, alongside scripts/ex05-regressions.test.cjs.
// Uses the real bundled adapter and validators; the model client is fully mocked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

function application() {
  const api = Module.createRequire(path.resolve('artifacts/api-server/package.json'));
  const built = api('esbuild').buildSync({
    entryPoints: ['artifacts/api-server/src/routes/functional-orchestrator.ts'],
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    alias: { '@workspace/db': path.resolve('scripts/db-denied-fixture.ts') },
  });
  const filename = path.resolve('artifacts/api-server/compact-boundaries-test.cjs');
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(built.outputFiles[0].text, filename);
  const contract = require(path.resolve('artifacts/api-server/src/lib/ex04-reference.cjs')).resolveContract();
  return { createModelProviders: m.exports.createModelProviders, contract };
}

function harness(agentId, values, messages, turn = { number: 1, max: 10 }) {
  const { createModelProviders, contract } = application();
  const profile = contract.agents.find(a => a.id === agentId);
  const calls = [];
  const provider = createModelProviders({ client: { messages: { create: async payload => {
    calls.push(payload);
    assert(values.length > 0, 'Unexpected additional model call');
    return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: payload.tool_choice.name, input: values.shift() }], usage: { input_tokens: 0, output_tokens: 0 } };
  } } } });
  return { calls, respond: () => provider.respond({ agent: agentId, system: profile.prompt, messages, history: [], turn }) };
}

function envelope(agentId, text, extra = {}) {
  const { resolveContract } = require(path.resolve('artifacts/api-server/src/lib/ex04-reference.cjs'));
  const profile = resolveContract().agents.find(a => a.id === agentId);
  return { text, stage: 'clarify', completed: [], pending: profile.diagnostic_criteria.map(c => c.id), lenses: [], closingSummary: '', nextStep: '', operationalClaims: [], ...extra };
}

test('Delivery com pergunta usa reparo completo e permite corrigir a composição exibida', async () => {
  const facts = 'Em duas reuniões, Camila interrompeu colegas e chamou suas propostas de básicas.';
  const request = 'Pode me dar um exemplo curto de abertura, baseado no que eu presenciei?';
  const messages = [{ role: 'user', content: facts }, { role: 'user', content: request }];
  const extra = {
    stage: 'explore',
    delivery: { kind: 'message', text: 'Quero conversar sobre duas reuniões em que vi interrupções e comentários sobre as propostas dos colegas. Como você percebeu esses episódios?' },
    authorship: { supportMode: 'optional_example', approachEvidence: [], requestEvidence: [{ message: 1, quote: request }], basisEvidence: [{ message: 0, quote: facts }], examplePurpose: 'Apoiar uma abertura pontual solicitada com fatos observados.' },
  };
  const first = envelope('FBK', 'Os episódios observados oferecem uma base concreta. Que ponto você pretende esclarecer?', extra);
  const repaired = envelope('FBK', 'Os episódios observados oferecem uma base concreta para revisar a abertura opcional.', extra);
  const h = harness('FBK', [first, repaired], messages);
  const result = await h.respond();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].tool_choice.name, 'registrar_resposta');
  assert.equal(h.calls[1].max_tokens, 2200);
  assert.equal(result.progress.delivery.text, extra.delivery.text);
  assert.equal((result.text.match(/\?/g) ?? []).length, 1);
  assert.doesNotMatch(result.text, /Não consegui organizar/);
});

test('Fechamento extenso usa reparo completo para alterar os campos realmente exibidos', async () => {
  const first = envelope('MNT', 'Síntese da conversa.', {
    stage: 'close', closingSummary: 'Há uma lacuna. '.repeat(48).trim(),
    nextStep: 'Podemos examinar essa lacuna. '.repeat(15).trim(),
  });
  const repaired = envelope('MNT', 'Síntese da conversa.', {
    stage: 'close', closingSummary: 'As alternativas ainda precisam ser explicitadas; essa lacuna permanece em aberto.',
    nextStep: 'O próximo passo possível é explicitar as alternativas que você considera.',
  });
  const h = harness('MNT', [first, repaired], [{ role: 'user', content: 'Quero comparar alternativas.' }], { number: 10, max: 10 });
  const result = await h.respond();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].tool_choice.name, 'registrar_resposta');
  assert.equal(h.calls[1].max_tokens, 2200);
  assert.equal(result.progress.stage, 'close');
  assert.equal(result.progress.closingSummary, repaired.closingSummary);
  assert.equal(result.progress.nextStep, repaired.nextStep);
  assert(result.text.trim().split(/\s+/).length <= 180);
  assert.equal((result.text.match(/\?/g) ?? []).length, 0);
  assert.doesNotMatch(result.text, /Não consegui consolidar/);
});

test('Edição compacta que introduz diagnóstico sem base é revalidada e recusada', async () => {
  const first = envelope('MNT', 'O problema ainda tem lacunas. Que resultado você busca? Que evidência está faltando?');
  const h = harness('MNT', [first, { text: 'A dificuldade real não é a reação dela; é que você ainda não definiu o que precisa mudar.' }], [{ role: 'user', content: 'Quero comparar alternativas.' }]);
  await assert.rejects(h.respond(), /UNSUPPORTED_FACT/);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].tool_choice.name, 'revisar_apresentacao');
  assert.equal(h.calls[1].max_tokens, 600);
  assert.deepEqual(JSON.parse(h.calls[1].messages[0].content), { candidate: first.text });
});
