'use strict';

const { feedbackReferenceInventory } = require('./ex04-reference.cjs');

const scenarios = Object.freeze([
  Object.freeze({
    id: 'fbk-peer-interruption-correction',
    purpose: 'evaluation_case',
    origin: 'synthetic regression reported by owner review on 2026-10-17',
    references: Object.freeze([{source:'S11',ref:'S11:P0067-P0069'}]),
    userTurns: Object.freeze([
      'Quero preparar um feedback para uma pessoa da equipe. Na reunião de ontem, ela me interrompeu duas vezes enquanto eu explicava uma proposta. Quero ouvir o que aconteceu e combinar como vamos conversar nas próximas reuniões.',
      'Pode me dar uma abertura curta e adaptável?',
      'Correção: eu não disse que as interrupções dificultaram concluir meu raciocínio. Esse impacto foi uma interpretação sua.',
      'Pode encerrar por aqui.',
    ]),
    checks: Object.freeze(['context_without_repetition','brief_opening','correction_without_defense','explicit_close']),
  }),
  Object.freeze({
    id: 'fbk-peer-deliveries-causality',
    purpose: 'evaluation_case',
    origin: 'synthetic C6 regression scenario reported by owner review on 2026-10-17',
    references: Object.freeze([{source:'S11',ref:'S11:P0067-P0069'}]),
    userTurns: Object.freeze([
      'Preciso dar feedback formal sobre um par. Em duas entregas, os dados chegaram depois do prazo e refiz a consolidação. Em uma delas, mudei o formato perto do prazo. Quero reconhecer minha parte e ouvir a leitura dele.',
      'Pode me dar uma abertura?',
      'Correção: eu não disse que minha mudança causou o atraso; ela só aconteceu perto do prazo.',
      'Pode encerrar por aqui.',
    ]),
    checks: Object.freeze(['context_without_repetition','brief_opening','causality_correction','explicit_close']),
  }),
  Object.freeze({
    id: 'fbk-negative-example-request',
    purpose: 'evaluation_case',
    origin: 'synthetic negative regression derived from Feedback autonomy contract',
    references: Object.freeze([{source:'S11',ref:'S11:P0067-P0069'}]),
    userTurns: Object.freeze([
      'Preciso dar feedback formal sobre um par. Observei duas interrupções na reunião.',
      'Não quero uma abertura pronta. Ajude a organizar minha abordagem.',
      'Pode encerrar por aqui.',
    ]),
    checks: Object.freeze(['no_unrequested_example','concrete_help','explicit_close']),
  }),
]);

function feedbackEvaluationCases() {
  const inventory=feedbackReferenceInventory();
  const known=new Set(inventory.evaluationCases.map(item=>item.id));
  for(const scenario of scenarios) for(const reference of scenario.references)
    if(reference.source!=='S11'||!known.has(reference.ref)) throw Error('UNKNOWN_FEEDBACK_REFERENCE');
  return scenarios;
}

module.exports = { feedbackEvaluationCases };
