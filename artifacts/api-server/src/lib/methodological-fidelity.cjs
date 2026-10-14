'use strict';
// Focused output checks: neither routing nor certification of semantic truth.
const REVISION='methodological-1';
const FIDELITY_PROMPT=`
REVISÃO METODOLÓGICA 1 — preservar autoria e estatuto do relato:
No 1:1 ao vivo, inclusive recebendo feedback, ajude a discriminar o que está
claro e o que falta e provoque a elaboração do próximo movimento pelo líder.
Não entregue a fala pronta antes de conhecer sua abordagem. Microdirecionamento
não é obrigação de redigir; pode apoiar uma distinção concreta ou uma escolha.
Exemplo pontual só revisa uma abordagem já elaborada, como opção; nunca receita.
Use authorship também no 1:1: explore sem exemplo; review ou optional_example
com referência literal à abordagem do líder e propósito de revisão pertinente.
Intenção de evitar conflito não demonstra que ceder protegeu o momento.
Propor ajuste não demonstra que um acordo foi preservado. Querer tirar escopo
para cumprir não demonstra que a equipe é incapaz de cumprir. Silêncio não
demonstra processamento nem evasão: não exclua uma dessas leituras sem relato.
Diferencie intenção, hipótese, decisão e resultado, com base só nas falas
disponíveis ANTES desta resposta. Reconheça efeitos ou capacidade explicitamente
relatados, sem ampliar seu alcance. Hipóteses identificadas continuam possíveis;
não converta receio, proposta ou condição em efeito observado.
Consulte o contexto já informado antes de perguntar; uma pergunta só é útil
quando trata uma lacuna material ainda aberta. Não reduza ajuda a perguntas:
uma distinção sustentada ou exame concreto de suposição pode fazer avançar.
Não escolha função por nome de arquivo, reunião ou caso. Preserve todas as
funções e a proteção pertinente diante de perigo físico realmente relatado.
`;
const patterns=[
 {name:'silence_processing',kind:'impact',match:/\bsil[eê]ncio\b[^.!?]*(?:\b(?:é|foi)\b[^.!?]*processamento|processamento[^.!?]*,\s*n[aã]o\s+evas[aã]o)/i},
 {name:'moment_protection',kind:'impact',match:/\b(?:rea[cç][aã]o|ceder|isso|movimento)\b[^.!?]*\bprote(?:ge|geu)\b[^.!?]*\bmomento\b/i},
 {name:'agreement_preserved',kind:'impact',match:/\b(?:isso|proposta|movimento|abordagem)\b[^.!?]*\b(?:preserva|preservou|garante|garantiu)\b[^.!?]*\bacordo\b/i},
 {name:'team_incapacity',kind:'viability',match:/\b(?:equipe|time)\b[^.!?]*(?:sem condi[cç][aã]o|n[aã]o (?:tem|teve) condi[cç][aã]o|n[aã]o (?:consegue|conseguiu|pode))[^.!?]*\bcumprir\b/i},
];
const uncertain=s=>/\b(?:hip[oó]tese|talvez|se|caso|poderia|pode ser|pode ajudar|pode preservar|possibilidade)\b|não (?:sabemos|sei|comprova|demonstra|podemos afirmar)|sem (?:base|evidência)|acho que|receio|pretendo|quero|vou tentar/i.test(s);
function validateMethodologicalFidelity(value,messages,parts){
 const users=messages.filter(m=>m.role==='user');
 for(const part of parts)for(const sentence of part.split(/(?<=[.!?\n])\s*/)){
  for(const rule of patterns){
   if(!rule.match.test(sentence))continue;
   // "pode ser X, não Y" still rules out Y. A possibility for X doesn't
   // establish exclusion of Y, even if another clause is conditional.
   const excludesAlternative=rule.name==='silence_processing'&&/,\s*n[aã]o\s+evas[aã]o/i.test(sentence);
   if(!excludesAlternative&&(sentence.includes('?')||uncertain(sentence)))continue;
   const supported=(value.operationalClaims??[]).some(c=>{
    if(c.kind!==rule.kind||c.role!=='user'||!sentence.includes(c.text))return false;
    const source=users[c.message]?.content;
    if(typeof source!=='string'||typeof c.quote!=='string'||!source.includes(c.quote)||!rule.match.test(c.quote))return false;
    const at=source.indexOf(c.quote);
    const full=source.slice(0,at).split(/[.!?\n]/).at(-1)+c.quote+source.slice(at+c.quote.length).split(/[.!?\n]/)[0];
    return !uncertain(full)&&!/\bnão (?:disse|afirmei|é verdade|confirmo)\b/i.test(full)&&!full.includes('?');
   });
   if(!supported)throw Error('UNSUPPORTED_FACT');
  }
 }
 return REVISION;
}
module.exports={REVISION,FIDELITY_PROMPT,validateMethodologicalFidelity};
