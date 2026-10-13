'use strict';
const {resolveUserEvidence}=require('./evidence-source.cjs');
const FEEDBACK_AUTONOMY_PROMPT=`
ORIENTAÇÃO AUTORITATIVA DO PROPRIETÁRIO — AUTORIA NO FEEDBACK:
“é provocar o líder, trazer clareza pra ele e perguntar como ele pretende dar o feedback”;
“senao o lider nao se desenvolve e fica viciado... nao eh a intenção”.
Não substitua julgamento, não prescreva nem faça da fala pronta o objetivo padrão.
A permissão documental para frases/exemplos é permissão contingente, não obrigação.
Reconheça momento e tensão, amplie a leitura pertinente e explore como o líder
pretende abordar a conversa e que mudança quer construir. Parta da elaboração
dele, pergunte sobre lacuna real, confronte suposições com respeito e ajude revisar
sua abordagem sem assumir autoria/decisão. Isso não é roteiro nem sequência fixa:
não repita pergunta respondida, não exija todos os critérios, não fique vazio ou
apenas devolvendo perguntas. Ofereça leitura concreta de fatos, hipóteses e opções
de raciocínio que ajudem o líder a decidir. Pedido vago de “como fazer” não autoriza
receita, discurso completo, “faça X” ou “diga essa frase” como solução automática.
Exemplo só pode apoiar elaboração existente, como opção identificada para revisar
um trecho, nunca substituindo o raciocínio ou a decisão. Não gere delivery por
padrão. Se não houver elaboração do líder para apoiar, deixe delivery null.
Em authorship registre supportMode explore, review ou optional_example, e
approachEvidence com trechos exatos da elaboração dele (apenas intenção de “dar
feedback” ou descrição do problema não são elaboração de como abordar). Em
optional_example, registre examplePurpose explicando a revisão pontual apoiada.
Sem exemplo, não é obrigatório haver elaboração: ajude construí-la com clareza.
Não trate receio como escolha moral pelo conforto; não garanta que clareza protege
a relação nem que adiar compromete confiança. Efeitos não relatados são hipótese
ou lacuna. Retrabalho relatado não comprova planejamento/confiança do cliente.
Não conduza causa desconhecida para falta de cuidado, revisão ou critério como
conclusão. Tensione essas suposições sem julgar a pessoa.
Fechamento reflete clareza, escolhas/lacunas e próximo movimento do líder, sem
afirmar execução ou compromisso não relatado. Não confunda fala sugerida pelo IAí
com elaboração, escolha ou execução do usuário. Proteção pertinente a perigo
físico não é enfraquecida; as funções e transições dos agentes permanecem.
`;
function validateFeedbackAuthorship(value,messages,parts){
 const a=value.authorship;
 if(!a||!['explore','review','optional_example'].includes(a.supportMode)||!Array.isArray(a.approachEvidence)||a.approachEvidence.length>4||typeof a.examplePurpose!=='string')throw Error('AUTONOMY_CONSTRAINT_FAILED');
 const resolved=a.approachEvidence.map(e=>resolveUserEvidence(e,messages));
 const hasExample=Boolean(value.delivery?.text?.trim());
 if(a.supportMode==='review'&&!resolved.length)throw Error('AUTONOMY_CONSTRAINT_FAILED');
 if(hasExample&&(a.supportMode!=='optional_example'||!resolved.length||a.examplePurpose.trim().length<10))throw Error('AUTONOMY_CONSTRAINT_FAILED');
 if(!hasExample&&a.supportMode==='optional_example')throw Error('AUTONOMY_CONSTRAINT_FAILED');
 // Narrow output guards, not routing rules or semantic certification.
 for(const part of parts){
  if(/(?:^|[.!?\n]\s*)(?:diga|fale|comece|use a frase|você deve|você pode (?:dizer|abrir|começar))\b/i.test(part))throw Error('AUTONOMY_CONSTRAINT_FAILED');
  for(const sentence of part.split(/(?<=[.!?\n])\s*/)){
   if(/(?:escolh\w*|protege\w*)[^.!?]*conforto|adiar[^.!?]*(?:compromete|destrói)[^.!?]*confiança|clareza[^.!?]*(?:protege|garante)[^.!?]*relação/i.test(sentence)&&!/\bnão (?:garante|protege|compromete|comprova|escolhe)\b/i.test(sentence))throw Error('UNSUPPORTED_FACT');
   if(/\b(?:afeta|afetou|compromete|comprometeu|prejudica|prejudicou)\b[^.!?]*(?:planejamento|andamento|confiança do cliente)/i.test(sentence)&&!sentence.includes('?')&&!/\bnão (?:podemos|consigo|é possível) afirmar|\bnão sei (?:dizer|afirmar)|\bhipótese\b/i.test(sentence)){
    const support=(value.operationalClaims??[]).some(c=>{
     if(c.kind!=='impact'||c.role!=='user'||!sentence.includes(c.text))return false;
     const source=messages.filter(m=>m.role==='user')[c.message]?.content;
     if(typeof source!=='string')return false;
     const at=source.indexOf(c.quote);if(at<0)return false;
     const quotedSentence=source.slice(0,at).split(/[.!?\n]/).at(-1)+c.quote+source.slice(at+c.quote.length).split(/[.!?\n]/)[0];
     return !/\b(?:não|sem|talvez|poderia|hipótese)\b|não sei|receio|tenho medo/i.test(quotedSentence);
    });
    if(!support)throw Error('UNSUPPORTED_FACT');
   }
  }
 }
 return {authorship:{supportMode:a.supportMode,approachEvidence:resolved.map(r=>r.evidence),examplePurpose:a.examplePurpose},normalizations:resolved.flatMap(r=>r.normalization?[r.normalization]:[])};
}
module.exports={FEEDBACK_AUTONOMY_PROMPT,validateFeedbackAuthorship};
