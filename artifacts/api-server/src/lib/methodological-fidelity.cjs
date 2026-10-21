'use strict';
// Focused output checks: neither routing nor certification of semantic truth.
const REVISION='methodological-2';
const FIDELITY_PROMPT=`
REVISÃO METODOLÓGICA 2 — preservar autoria e estatuto do relato:
No 1:1 ao vivo, inclusive recebendo feedback, ajude a discriminar o que está
claro e o que falta e provoque a elaboração do próximo movimento pelo líder.
Não entregue a fala pronta antes de conhecer sua abordagem. Microdirecionamento
não é obrigação de redigir; pode apoiar uma distinção concreta ou uma escolha.
Exemplo pontual é opção, nunca receita: pode revisar uma abordagem ou apoiar sua elaboração quando explicitamente pedido e baseado em fatos relatados.
Use authorship também no 1:1: explore sem exemplo; review ou optional_example
com referência literal à abordagem ou, sem abordagem anterior, ao pedido explícito e à base factual, com propósito limitado e pertinente.
Intenção de evitar conflito não demonstra que ceder protegeu o momento.
Propor ajuste não demonstra que um acordo foi preservado. Querer tirar escopo
para cumprir não demonstra que a equipe é incapaz de cumprir. Silêncio não
demonstra processamento nem evasão: não exclua uma dessas leituras sem relato.
Diferencie intenção, hipótese, decisão e resultado, com base só nas falas
disponíveis ANTES desta resposta. Reconheça efeitos ou capacidade explicitamente
relatados, sem ampliar seu alcance. Hipóteses identificadas continuam possíveis;
não converta receio, proposta ou condição em efeito observado.
Não afirme a dificuldade real ou a motivação do líder sem relato; transforme a leitura em hipótese aberta. Não converta dois relatos em nexo causal, mesmo dentro de fala proposta condicional.
Confronte adiamentos pelos fatos e suas lacunas, sem censura ou bronca.
Ter adiado não comprova intenção de reter um assunto. Não substitua o receio
declarado por uma certeza corretiva sobre a intenção ou a dificuldade do líder.
Se ele apontar efeito negativo do tom, reconheça a correção e ajuste a ajuda,
sem defender a leitura anterior nem exigir nova justificativa para ajudá-lo.
Consulte o contexto já informado antes de perguntar; uma pergunta só é útil
quando trata uma lacuna material ainda aberta. Não reduza ajuda a perguntas:
uma distinção sustentada ou exame concreto de suposição pode fazer avançar.
Não escolha função por nome de arquivo, reunião ou caso. Preserve todas as
funções e a proteção pertinente diante de perigo físico realmente relatado.
`;
const patterns=[
 {name:'causal_assertion',kind:'impact',feedbackOnly:true,match:/\b(?:causou|gerou|provocou|resultou\s+em)\b/i},
 {name:'inner_difficulty_certainty',kind:'impact',match:/\b(?:a|sua|minha)\s+(?:dificuldade|quest[aã]o|tens[aã]o|problema)\s+real\s+(?:n[aã]o\s+)?(?:é|est[aá])(?=\s|[,.!?;:]|$)/i},
 {name:'corrective_difficulty_certainty',kind:'impact',match:/\b(?:a|sua|minha)\s+dificuldade\s+n[aã]o\s+é(?=\s)[^.!?\n]*[—–:-]\s*é\s+(?:que\s+)?voc[eê](?=\s|[,.!?;:]|$)/i},
 {name:'communication_effect_assertion',kind:'impact',match:/\b(?:isso|falha de comunica[cç][aã]o|falta de comunica[cç][aã]o)\b[^.!?]*\b(?:prejudicou|prejudica|criou|gerou|causou)\b[^.!?]*\b(?:leitura|avalia[cç][aã]o|conclus[aã]o|interpreta[cç][aã]o|entendimento)\b/i},
 {name:'embedded_causal_assertion',kind:'impact',embeddedCausal:true,match:/\b(?:dizendo|dizer|afirmar|falar|explicar|pontuar)\b[^.!?]*\b(?:isso|epis[oó]dios|comportamentos)\b[^.!?]*\b(?:criou|causou|gerou|provocou)\b/i,sourceMatch:/\b(?:isso|epis[oó]dios|comportamentos)\b[^.!?]*\b(?:criou|causou|gerou|provocou)\b/i},
 {name:'silence_processing',kind:'impact',match:/\bsil[eê]ncio\b[^.!?]*(?:\b(?:é|foi)\b[^.!?]*processamento|processamento[^.!?]*,\s*n[aã]o\s+evas[aã]o)/i},
 {name:'moment_protection',kind:'impact',match:/\b(?:rea[cç][aã]o|ceder|isso|movimento)\b[^.!?]*\bprote(?:ge|geu)\b[^.!?]*\bmomento\b/i},
 {name:'agreement_preserved',kind:'impact',match:/\b(?:isso|proposta|movimento|abordagem)\b[^.!?]*\b(?:preserva|preservou|garante|garantiu)\b[^.!?]*\bacordo\b/i},
 {name:'team_incapacity',kind:'viability',match:/\b(?:equipe|time)\b[^.!?]*(?:sem condi[cç][aã]o|n[aã]o (?:tem|teve) condi[cç][aã]o|n[aã]o (?:consegue|conseguiu|pode))[^.!?]*\bcumprir\b/i},
];
const uncertain=s=>/\b(?:hip[oó]tese|talvez|se|caso|poderia|pode ser|pode ajudar|pode preservar|possibilidade)\b|não (?:sabemos|sei|comprova|demonstra|podemos afirmar)|sem (?:base|evidência)|acho que|receio|pretendo|quero|vou tentar/i.test(s);
const negatesCausality=s=>{
 const causal=s.search(/\b(?:causou|gerou|provocou|resultou\s+em)\b/i);
 if(causal<0)return false;
 const prefix=s.slice(0,causal).split(/[.!?;:\n]|[—–]|\b(?:mas|por[eé]m|contudo)\b/i).at(-1)??'';
 return /\bn[aã]o\b/i.test(prefix)&&!/\bn[aã]o\s+(?:s[oó]|apenas|somente)(?=\s|[,.!?;:]|$)/i.test(prefix);
};
function validateMethodologicalFidelity(value,messages,parts,agent=null){
 const users=messages.filter(m=>m.role==='user');
 for(const part of parts)for(const sentence of part.split(/(?<=[.!?;\n])\s*|,\s*(?:mas|por[eé]m|contudo)\s+/i)){
  for(const rule of patterns){
   if(rule.feedbackOnly&&agent!=='FBK')continue;
   const match=rule.embeddedCausal&&part===value.delivery?.text?(rule.sourceMatch??rule.match):rule.match;
   if(!match.test(sentence))continue;
   if(rule.name==='causal_assertion'&&negatesCausality(sentence))continue;
   if(rule.name==='communication_effect_assertion'&&/\bn[aã]o\s+(?:(?:vou|posso|podemos)\s+)?(?:afirmar|dizer|confirmar|confirmo)\s+que\s*$/i.test(sentence.slice(0,sentence.search(match))))continue;
   // "pode ser X, não Y" still rules out Y. A possibility for X doesn't
   // establish exclusion of Y, even if another clause is conditional.
   const excludesAlternative=rule.name==='silence_processing'&&/,\s*n[aã]o\s+evas[aã]o/i.test(sentence);
   if(['inner_difficulty_certainty','corrective_difficulty_certainty'].includes(rule.name)){
    const at=sentence.search(rule.match),prefix=sentence.slice(0,at);
    if(/\b(?:talvez|hip[oó]tese|possibilidade|n[aã]o sabemos se|n[aã]o sei se|sem afirmar que|ser[aá] que|voc[eê] diria que)\b/i.test(prefix))continue;
   }else if(!excludesAlternative&&!rule.embeddedCausal&&(sentence.includes('?')||uncertain(sentence)))continue;
   if(rule.embeddedCausal&&/\bn[aã]o\s+(?:(?:vou|vamos|posso|podemos|devemos|quero|iria)\s+)?(?:dizer|afirmar|falar|explicar|pontuar)\b/i.test(sentence))continue;
   if(rule.embeddedCausal&&/\b(?:talvez|hip[oó]tese|pode ter|n[aã]o sabemos se|sem afirmar que)\b/i.test(sentence))continue;
   const supported=(value.operationalClaims??[]).some(c=>{
    if(c.kind!==rule.kind||c.role!=='user'||!sentence.includes(c.text))return false;
    const source=users[c.message]?.content;
    if(typeof source!=='string'||typeof c.quote!=='string'||!source.includes(c.quote)||!(rule.sourceMatch??rule.match).test(c.quote))return false;
    const at=source.indexOf(c.quote);
    const full=source.slice(0,at).split(/[.!?\n]/).at(-1)+c.quote+source.slice(at+c.quote.length).split(/[.!?\n]/)[0];
    return !uncertain(full)&&!(rule.name==='causal_assertion'&&negatesCausality(full))&&!/\bnão (?:disse|afirmei|é verdade|confirmo)\b/i.test(full)&&!full.includes('?');
   });
   if(!supported)throw Error('UNSUPPORTED_FACT');
  }
 }
 return REVISION;
}
module.exports={REVISION,FIDELITY_PROMPT,validateMethodologicalFidelity};
