'use strict';
// Pure, lossless field extraction. Original paragraphs remain in the catalogue.
function extractParagraph(paragraph) {
  const text=paragraph.text;
  const labels=[...text.matchAll(/\b(Onboarding|Marketing)\s*:/giu)];
  const arrow=text.indexOf('→');
  const boundaries=[{start:0,kind:'situation'},
    ...labels.map(m=>({start:m.index,kind:m[1].toLowerCase()})),
    ...(arrow>=0?[{start:arrow,kind:'annotation'}]:[])];
  const sorted=boundaries.sort((a,b)=>a.start-b.start)
    .filter((b,i,a)=>i===0||b.start!==a[i-1].start||b.kind!=='situation');
  // A standalone label at zero replaces the zero-length situation field.
  const fields=sorted.map((b,i)=>({...b,end:sorted[i+1]?.start??text.length,
    text:text.slice(b.start,sorted[i+1]?.start??text.length)}))
    .filter(f=>f.end>f.start);
  return {ref:paragraph.ref,fields,
    referenceText:fields.filter(f=>f.kind==='situation').map(f=>f.text).join('')};
}
function extractBlock(paragraphs) {
  let context=null;
  return paragraphs.map(p=>{
    const label=p.text.trim().match(/^(Onboarding|Marketing)\s*:?\s*$/iu);
    if(label)context=label[1].toLowerCase();
    else if(!p.text.trim()||/^(?:\d+\.\s|BLOCO\s|[([](?:Antes|Durante|Depois))/iu.test(p.text.trim()))context=null;
    if(context)return {ref:p.ref,fields:p.text.length?[{kind:context,start:0,end:p.text.length,text:p.text}]:[],
      referenceText:'',fieldContext:'standalone_label'};
    return extractParagraph(p);
  });
}
// Concise operational additions, traced to the canonical source, not exercises.
const canonicalRules=[
 {refs:['P0059','P0060','P0061','P0062','P0063','P0064'],
  text:'Encerre com clareza suficiente para o próximo passo, sem exigir situação resolvida; saída não abrupta, aberta à continuidade sem dependência. Direcionamento final curto quando pertinente; frase padrão só com base para afirmar clareza.'},
 {refs:['P0067','P0068','P0069','P0070','P0071','P0072','P0073','P0074','P0075','P0076','P0077'],
  text:'Diferencie os oito agentes pelo tipo de leitura e atuação, não pelo tema. Mentor enquadra possibilidades mesmo sem alternativas prontas; 1:1 conduz ao vivo; Feedback prepara comunicação; Perfil requer recorrência relatada/autorizada. Evolução não conduz o diálogo atual.'},
 {refs:['P0080','P0082','P0083','P0084','P0085','P0086','P0087','P0088','P0089','P0090','P0091','P0092','P0093'],
  text:'Não sobreponha funções centrais: lentes podem enriquecer, não executar outro domínio. Priorize domínio, coerência e momento real; só ambiguidade decisiva pede pergunta curta. Função clara assume, incorpora nova evidência e mantém voz única. Arquivo de origem não determina rota.'},
 {refs:['P0210','P0211','P0212','P0213','P0214','P0215','P0216','P0217','P0218'],
  text:'Revisão vigente D01–D03: exemplos/classificações anteriores devem ser compatíveis, não gabaritos exclusivos. Crises analisa antecipação e reconstrução; só dano em curso/ameaça concreta permite contenção proporcional. Autoria exige leitura útil e provocação, não script, decisão pronta ou perguntas mecânicas; exemplos curtos opcionais e adaptáveis. Transições invisíveis preservam contexto e dez trocas globais, sem corte cego. Evolução segue posterior e desativada; não registrar SED provisório. Decisões expressas e princípios delimitam domínio; definições orientam função; contradição substantiva nova requer decisão, sem precedência automática pelo título do arquivo.'},
];
module.exports={extractParagraph,extractBlock,canonicalRules};
