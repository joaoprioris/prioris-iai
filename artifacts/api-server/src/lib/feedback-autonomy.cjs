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
Não destaque mecânica interna com “Antes de sugerir fala pronta, preciso...”.
Apoie diretamente a elaboração: reconheça a tensão, amplie a leitura sustentada
e use UMA questão focal sobre UMA lacuna, se necessária. Não faça questionário
nem cascata; não obrigue o líder a elaborar sozinho antes de ajudá-lo a pensar.
Exemplo curto e adaptável pode apoiar elaboração, sem ser obrigação nem discurso completo.
Sem abordagem própria relatada, só o forneça diante de pedido explícito e fatos
concretos já relatados, até40 palavras de abertura pontual. Registre requestEvidence
com o pedido e basisEvidence com os fatos; não atribua o exemplo ao líder.
Pedidos de sugerir, propor ou elaborar uma abertura breve também são pedidos
explícitos; cite a formulação real completa, não apenas um fragmento sem o pedido.
Negação, retirada e pergunta relatada de outra pessoa não autorizam exemplo.
Em authorship registre supportMode explore, review ou optional_example. Review
requer approachEvidence literal da abordagem própria. Optional_example usa essa
abordagem ou o pedido explícito com base factual; examplePurpose delimita o apoio.
Sem essas bases, delivery null. Uma descrição vaga do problema não basta.
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
 const reject=reason=>{throw Object.assign(Error('AUTONOMY_CONSTRAINT_FAILED'),{validationReason:reason});};
 const a=value.authorship;
 if(!a||!['explore','review','optional_example'].includes(a.supportMode)||!Array.isArray(a.approachEvidence)||a.approachEvidence.length>4||typeof a.examplePurpose!=='string')reject('INVALID_AUTHORSHIP_SHAPE');
 if(a.requestIntent!==undefined&&!['brief_adaptable_example','not_requested'].includes(a.requestIntent))reject('INVALID_AUTHORSHIP_SHAPE');
 const resolved=a.approachEvidence.map(e=>resolveUserEvidence(e,messages));
 const request=(a.requestEvidence??[]),basis=(a.basisEvidence??[]);
 if(!Array.isArray(request)||!Array.isArray(basis)||request.length>2||basis.length>4)reject('INVALID_REQUEST_BASIS_SHAPE');
 const requested=request.map(e=>resolveUserEvidence(e,messages)),grounded=basis.map(e=>resolveUserEvidence(e,messages));
 const negative=q=>/\b(?:n[aã]o\s+(?:quero|queria|preciso|gostaria|me d[eê]|d[eê]|mostre)|evite|dispenso)\s+(?:mais\s+)?(?:um(?:a)?\s+)?(?:exemplos?|sugest[aã]o|(?:uma )?falas?|frases?(?:\s+iniciais?)?|abertura)\b|\bsem\s+(?:nenhum[a]?\s+)?(?:exemplos?|sugest[aã]o|frases?(?:\s+iniciais?)?|abertura)\b/i.test(q)||
  /\b(?:n[aã]o|nunca)\s+(?:(?:quero|preciso|precisa|gostaria)\s+(?:que\s+)?)?(?:(?:voc[eê]|me)\s+)?(?:(?:pode|poderia|deve)\s+)?(?:sugerir|sugira|propor|redigir|escrever|dar|d[eê]|mostrar|mostre|preparar|elaborar)\b[^.!?\n]{0,60}\b(?:abertura|exemplo|fala|sugest[aã]o)\b/i.test(q);
 const reported=q=>/\b(?:perguntou|pediu|disse|falou|solicitou)\b[^.!?\n]{0,80}(?:[:—-]|\b(?:se|que|para)\b)/i.test(q)||
  /\b(?:pedido|fala|pergunta)\s+(?:de|do|da)\b[^.!?\n]{0,60}\b(?:foi|é)\s*[:“"']/i.test(q)||
  /^\s*[“"‘']*(?:ele|ela|[oa] colega|minh[oa] chefe)\s+(?:pode|poderia|consegue|quer|gostaria|vai)\b/i.test(q);
 const normalized=q=>q.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 // Speech-act constructions, not whole-sentence exceptions. Semantic intent is
 // supplied by the existing generation, and never replaces literal provenance.
 const direct=q=>/(?:^|[.!?;]\s*|\beu\s+)(?:por favor,?\s*)?(?:voce\s+)?(?:pode(?:ria)?|consegue|seria possivel|quero|queria|gostaria|preciso|me ajude|me ajuda|me auxilie|me apoie|ajude[- ]me|ajuda[- ]me)\b/.test(normalized(q).trim().replace(/^[“"'‘\s]+/,''));
 const brief=q=>/\b(?:abertura|frase inicial|frase de inicio|inicio da conversa|comeco da conversa|exemplo|sugestao|uma fala)\b/.test(normalized(q));
 const formulation=q=>/\b(?:formul\w*|elabor\w*|escrev\w*|redig\w*|mont\w*|rascunh\w*|suger\w*|propo\w*|adapt\w*)\b/.test(normalized(q));
 const tooBroad=q=>/\b(?:discurso|roteiro)\s+(?:completo|inteiro)|\btoda a conversa\b|\bdecida por mim\b/.test(normalized(q));
 const requestVoice=q=>direct(q)||/^\s*(?:por favor,?\s*)?(?:me\s+)?(?:sugira|proponha|redija|escreva|prepare|mostre|d[eê]|d[aá]|como (?:eu )?(?:abro|come[cç]o|digo))\b/i.test(q)||(a.requestIntent==='brief_adaptable_example'&&(/\?\s*[”"'’]?\s*$/.test(q)||/\b(?:me|eu)\b/i.test(q)));
 const asks=q=>!negative(q)&&!tooBroad(q)&&requestVoice(q)&&(a.requestIntent==='brief_adaptable_example'||(direct(q)&&brief(q)&&(formulation(q)||/\b(?:quero|queria|gostaria|preciso)\b/.test(normalized(q))))||(/\b(?:pode(?:ria)?|consegue|quero|gostaria|me (?:d[eê]|d[aá]|mostre))\b[^.!?]{0,100}\b(?:exemplo|sugest[aã]o|uma fala)\b/i.test(q)||
  /\b(?:pode(?:ria)?|consegue)\b[^.!?\n]{0,40}\b(?:sugerir|propor|mostrar|redigir|escrever|rascunhar|preparar|elaborar)\s+(?:um(?:a)?\s+)?(?:abertura|exemplo|fala|sugest[aã]o)\b/i.test(q)||
  /\b(?:quero|gostaria(?: de)?|me (?:sugira|proponha|mostre|d[eê]|d[aá])|sugira|proponha|redija|escreva|prepare)\s+(?:um(?:a)?\s+)?(?:abertura|exemplo|fala|sugest[aã]o)\b/i.test(q)||
  /\bcomo (?:eu )?(?:abro|come[cç]o|digo)\b/i.test(q)));
 const users=messages.filter(m=>m.role==='user'),last=users.at(-1)?.content??'';
 const withdrawn=negative(last)||/\b(?:n[aã]o|nunca)\s+(?:(?:quero|preciso|gostaria|me|voc[eê]|pode|poderia|que)\s+){0,4}(?:ajude|ajudar|formule|formular|elabore|elaborar|redija|redigir|sugira|sugerir)\b|\b(?:retiro|cancelo|desisto d[oa]|deixa (?:isso )?pra l[aá]|deixe (?:isso )?para l[aá])\b/i.test(last);
 const explicit=!withdrawn&&requested.some(r=>{const q=r.evidence.quote,source=users[r.evidence.message]?.content??'',at=source.indexOf(q),prefix=source.slice(0,at).split(/[.!?\n]/).at(-1)??'';return asks(q)&&!negative(prefix+q)&&!reported(prefix+q)&&!/\b(?:n[aã]o|nunca)\b[^.!?\n]{0,35}\b(?:ajud\w*|formul\w*|elabor\w*|frase inicial)\b/i.test(prefix+q)&&!/^\s*(?:ele|ela|meu chefe|minha chefe|minh[oa] colega)\b/i.test(prefix+q);});
 const factual=grounded.some(r=>!r.evidence.quote.includes('?')&&!/^(?:quero|preciso|gostaria|tenho que)\b/i.test(r.evidence.quote.trim()));
 const requestedSupport=explicit&&factual;
 const hasApproach=resolved.some(r=>/\b(?:pergunt\w*|dizer|diria|falaria|abord\w*|come[cç]\w*|retom\w*|explic\w*)\b[\s\S]{12,}/i.test(r.evidence.quote));
 const hasExample=Boolean(value.delivery?.text?.trim());
 if(hasExample&&withdrawn)reject('EXAMPLE_WITHDRAWN');
 if(a.supportMode==='review'&&!resolved.length)reject('REVIEW_WITHOUT_APPROACH');
 if(hasExample&&a.supportMode!=='optional_example')reject('EXAMPLE_MODE_MISMATCH');
 if(hasExample&&!hasApproach&&!requestedSupport)reject(!explicit?'EXPLICIT_REQUEST_MISSING':'FACTUAL_BASIS_MISSING');
 if(hasExample&&a.examplePurpose.trim().length<10)reject('EXAMPLE_PURPOSE_MISSING');
 // Exact provenance alone isn't proof of elaboration. Reject the narrow,
 // evident misuse of a problem/intent-only quote as an approach to revise.
 if(hasExample&&!hasApproach&&value.delivery.text.trim().split(/\s+/).length>40)reject('EXAMPLE_TOO_LONG');
 if(!hasExample&&a.supportMode==='optional_example')reject('OPTIONAL_EXAMPLE_WITHOUT_DELIVERY');
 // Narrow output guards, not routing rules or semantic certification.
 for(const part of parts){
  if(/(?:^|[.!?\n]\s*)(?:diga|fale|comece|use a frase|você deve|você pode (?:dizer|abrir|começar))\b/i.test(part))reject('IMPERATIVE_PRESENTATION');
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
 return {authorship:{supportMode:a.supportMode,...(a.requestIntent?{requestIntent:a.requestIntent}:{}),approachEvidence:resolved.map(r=>r.evidence),examplePurpose:a.examplePurpose,...(requested.length?{requestEvidence:requested.map(r=>r.evidence)}:{}),...(grounded.length?{basisEvidence:grounded.map(r=>r.evidence)}:{})},normalizations:[...resolved,...requested,...grounded].flatMap(r=>r.normalization?[r.normalization]:[])};
}
// FBK-only composition checks. Never select a function or delete ambiguous text.
function validateExampleComposition(value,parts){
 const example=value.delivery?.text;
 if(typeof example!=='string'||!example.trim())return;
 const reject=reason=>{throw Object.assign(Error('AUTONOMY_CONSTRAINT_FAILED'),{validationReason:reason});};
 if(example.trim().split(/\s+/).length>40)reject('EXAMPLE_TOO_LONG');
 if(/(?:^|[.!?\n]\s*)(?:voc[eê]\s+pode\s+(?:descrever|dizer|abrir|come[cç]ar|escrever|registrar)\s*:|(?:depois|em seguida)\s+registre\b|(?:diga|descreva|use a frase)\s*:)/i.test(example))
  reject('EXAMPLE_NOT_INTERLOCUTOR_SPEECH');
 const {locatePresentation}=require('./evidence-source.cjs');
 for(const part of parts){
  // Exact contiguous excerpts only: reject, never silently remove a fragment.
  const quoted=[...part.matchAll(/["“]([^"“”]+)["”]/gu)].map(m=>m[1]);
  const sentences=example.split(/(?<=[.!?])\s+/);
  if(quoted.some(q=>q.trim().split(/\s+/).length>=4&&locatePresentation(example,q).length)||
     sentences.some(s=>s.trim().split(/\s+/).length>=4&&locatePresentation(part,s).length))
    throw Error('DUPLICATE_DELIVERY');
 }
}
module.exports={FEEDBACK_AUTONOMY_PROMPT,validateFeedbackAuthorship,validateExampleComposition};
