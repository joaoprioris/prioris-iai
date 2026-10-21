'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decideRoute, AGENTS } = require('./functional-policy.cjs');
const base = { scope: 'leadership', job: 'compare_paths', confidence: 'high' };
test('Contenção com confiança baixa exige esclarecimento',()=>assert.equal(decideRoute({...base,confidence:'low',ownClarityImpaired:true}).mode,'clarify'));
test('Contenção com confiança moderada não presume incapacidade',()=>assert.equal(decideRoute({...base,confidence:'moderate',ownClarityImpaired:true}).mode,'clarify'));
const history = { userId: 'u-test', organizationId: 'org-test', memoryOwnerId: 'u-test', memoryOrganizationId: 'org-test', historyAuthorized: true, historyCorroborated: true, historyCompatibleWithCurrent: true };
test('Comparar caminhos não ativa 1:1 pelo nome da reunião', () => assert.equal(decideRoute({ ...base, bilateralConversation: true }).agent, 'MNT'));
test('Fechar compromisso bilateral seleciona 1:1', () => assert.equal(decideRoute({ ...base, job: 'close_bilateral', bilateralConversation: true }).agent, 'OTO'));
test('Fechamento sem interlocutor precisa ser esclarecido', () => assert.equal(decideRoute({ ...base, job: 'close_bilateral' }).mode, 'clarify'));
test('Mensagem com decisão definida seleciona Feedback', () => assert.equal(decideRoute({ ...base, job: 'prepare_message', decisionSufficientlyClear: true }).agent, 'FBK'));
test('Mensagem com decisão indefinida não produz script prematuro', () => assert.equal(decideRoute({ ...base, job: 'prepare_message' }).mode, 'clarify'));
test('Desgaste de terceiro não implica Contenção do usuário', () => assert.equal(decideRoute({ ...base, job: 'understand_impact', otherPersonExhausted: true }).agent, 'IMP'));
test('Capacidade própria comprometida precede função', () => assert.equal(decideRoute({ ...base, ownClarityImpaired: true }).agent, 'CTN'));
test('Dano externo imediato precede Contenção', () => assert.equal(decideRoute({ ...base, ownClarityImpaired: true, immediateExternalRisk: true, riskEvidence: 'Conflito escalando agora, com informação incorreta publicada.' }).agent, 'CRS'));
test('Prazo curto por si só não ativa Crises', () => assert.equal(decideRoute({ ...base, urgentDeadline: true }).agent, 'MNT'));
test('Risco marcado sem contexto exige pergunta', () => assert.equal(decideRoute({ ...base, immediateExternalRisk: true }).mode, 'clarify'));
test('Risco já encerrado não mantém Crises artificialmente', () => {
  const r = decideRoute({ ...base, job: 'close_bilateral', bilateralConversation: true, immediateExternalRisk: false }, {}, 'CRS');
  assert.equal(r.agent, 'OTO'); assert.equal(r.transition, true);
});
test('Emergência pessoal encaminha ao apoio humano, não crise organizacional', () => assert.equal(decideRoute({ ...base, personalEmergency: true, immediateExternalRisk: true, riskEvidence: 'Dano.' }).mode, 'human_support'));
test('Pedido fora de escopo não força especialização', () => assert.equal(decideRoute({ ...base, scope: 'outside' }).agent, null));
test('Confiança insuficiente exige exploração', () => assert.equal(decideRoute({ ...base, confidence: 'moderate' }).mode, 'clarify'));
test('Episódio isolado não comprova padrão', () => assert.equal(decideRoute({ ...base, job: 'explore_pattern' }).mode, 'clarify'));
test('Recorrência relatada permite hipótese, sem autorizar escrita de memória', () => {
  const r = decideRoute({ ...base, job: 'explore_pattern', ownRecurrenceReported: true });
  assert.equal(r.agent, 'PRF'); assert.equal(r.reason, 'user_reported_hypothesis'); assert.equal(r.memoryWriteAllowed, false);
});
test('Texto do classificador não concede autorização de histórico', () => assert.deepEqual(decideRoute({ ...base, historyAuthorized: true, historyCorroborated: true }).background, []));
test('Histórico autorizado e corroborado influencia em segundo plano', () => {
  const r = decideRoute(base, history); assert.equal(r.agent, 'MNT'); assert.deepEqual(r.background, ['EVL']);
});
test('Memória de outro cliente é excluída', () => assert.deepEqual(decideRoute(base, { ...history, memoryOrganizationId: 'org-other' }).background, []));
test('Memória de outra pessoa é excluída', () => assert.deepEqual(decideRoute(base, { ...history, memoryOwnerId: 'u-other' }).background, []));
test('Memória sem autorização é excluída', () => assert.deepEqual(decideRoute(base, { ...history, historyAuthorized: false }).background, []));
test('Histórico incompatível com contexto não governa a conversa', () => assert.deepEqual(decideRoute(base, { ...history, historyCompatibleWithCurrent: false }).background, []));
test('Clareamento mantém contexto anterior sem simular transição concluída', () => {
  const r = decideRoute({ ...base, confidence: 'low' }, {}, 'MNT'); assert.equal(r.previousAgent, 'MNT'); assert.equal(r.transition, false);
});
test('Mesmo agente não produz troca artificial', () => assert.equal(decideRoute(base, {}, 'MNT').transition, false));
test('Evolução não vira oitavo chat nem gera score organizacional', () => {
  assert.equal(AGENTS.includes('EVL'), false); assert.equal(decideRoute(base, history).organizationalScoreAllowed, false);
});
test('Entradas malformadas falham antes de rotear', () => {
  assert.throws(() => decideRoute({ ...base, ownClarityImpaired: 'false' }), TypeError);
  assert.throws(() => decideRoute({ ...base, job: 'EVL' }), TypeError);
  assert.throws(() => decideRoute(base, { historyAuthorized: 'true' }), TypeError);
  assert.throws(() => decideRoute(base, {}, 'EVL'), TypeError);
});
