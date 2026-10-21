'use strict';
const STAGES=['clarify','structure','explore','direct','close'];
function turnDirective(turn={}){
 const n=turn.number??1,max=turn.max??10;
 if(!Number.isInteger(n)||!Number.isInteger(max)||max!==10||n<1||n>max)throw new Error('INVALID_TURN_CONTROL');
 const base=`CONTROLE DO SERVIDOR: troca ${n} de ${max}. A contagem não reinicia ao mudar de agente. Reuse os fatos já relatados, não repita perguntas respondidas e atualize a leitura quando o usuário corrigir informações. O estágio é situacional, não uma fase fixa por número. Não alegue conclusão só por ter atingido o limite.`;
 if(n===max)return base+' ÚLTIMA TROCA: faça fechamento estruturado agora. Sintetize o caso com fatos fornecidos, organize a leitura, reconheça pendências e deixe um próximo passo proporcional. Não faça nova pergunta nem abra investigação. stage deve ser close. Se não houver informação suficiente, diga isso sem inventar conclusão. Termine com abertura para uma futura conversa, sem incentivar dependência.';
 if(n===max-1)return base+' PENÚLTIMA TROCA: priorize consolidação e direcionamento. Só faça uma pergunta se ela for indispensável para concluir na próxima troca. Não abra novos ramos. Prepare o fechamento.';
 return base+' Esclareça apenas o que falta para sua função. Não dê aula genérica nem apresente todas as lentes. Encerre antes do limite se houver clareza suficiente para o próximo passo.';
}
function validateProgress(value,profile,messages,turn={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.text!=='string'||!value.text.trim()||value.text.length>1200)throw new Error('INVALID_PROGRESSION');
 if(!STAGES.includes(value.stage)||!Array.isArray(value.completed)||!Array.isArray(value.pending)||!Array.isArray(value.lenses))throw new Error('INVALID_PROGRESSION');
 const ids=new Set((profile.diagnostic_criteria??[]).map(x=>x.id));const users=messages.filter(x=>x.role==='user');
 const completed=value.completed.map(x=>{
  if(!x||!ids.has(x.criterion)||!Array.isArray(x.evidence)||x.evidence.length<1||x.evidence.length>4)throw new Error('INVALID_PROGRESSION');
  const evidence=x.evidence.map(e=>{if(!e||!Number.isInteger(e.message)||e.message<0||e.message>=users.length||typeof e.quote!=='string'||e.quote.trim().length<5||e.quote.length>240||!users[e.message].content.includes(e.quote))throw new Error('INVALID_PROGRESS_EVIDENCE');return {message:e.message,quote:e.quote}});
  return {criterion:x.criterion,evidence};
 });
 const done=new Set(completed.map(x=>x.criterion));
 if(done.size!==completed.length||new Set(value.pending).size!==value.pending.length||value.pending.some(x=>!ids.has(x)||done.has(x))||done.size+value.pending.length!==ids.size)throw new Error('INVALID_PROGRESSION');
 const allowed=new Set(profile.allowed_transversal_lenses??[]);
 if(new Set(value.lenses).size!==value.lenses.length||value.lenses.some(x=>!allowed.has(x)))throw new Error('INVALID_PROGRESSION');
 const terminal=turn.number===10||value.stage==='close';
 if(value.stage!=='close'&&/com isso, você já tem mais clareza|iaí, posso te apoiar no próximo passo/i.test(value.text))throw new Error('INVALID_CLOSURE');
 if(value.stage==='close'&&(turn.number??1)<10&&!done.has(profile.id+'.next'))throw new Error('INVALID_CLOSURE');
 if(terminal&&value.stage!=='close')throw new Error('INVALID_CLOSURE');
 if(terminal&&(typeof value.closingSummary!=='string'||value.closingSummary.trim().length<15||value.closingSummary.length>1200||typeof value.nextStep!=='string'||value.nextStep.trim().length<10||value.nextStep.length>800))throw new Error('INVALID_CLOSURE');
 if(terminal&&(value.closingSummary.includes('?')||value.nextStep.includes('?')))throw new Error('INVALID_CLOSURE');
 // Compose the mandatory closure from validated fields rather than requiring
 // the model to duplicate the same strings inside a separate text field.
 let delivery='';let deliveryKind=null;
 const emptyDelivery=value.delivery===''||(value.delivery&&value.delivery.kind===null&&value.delivery.text===null);
 if(value.delivery!==undefined&&value.delivery!==null&&!emptyDelivery){
  const d=value.delivery;const kind=profile.id==='FBK'?'message':profile.id==='OTO'?'micro_move':null;
  if(kind===null||!d||d.kind!==kind||typeof d.text!=='string'||!d.text.trim()||d.text.length>1200||d.text.includes('[ENCERRAR]'))throw new Error('INVALID_PROGRESSION');
  deliveryKind=d.kind;delivery='\n\nUma formulação possível para usar nessa conversa:\n“'+d.text.trim()+'”';
 }
 const text=terminal?value.closingSummary.trim()+'\n\n'+value.nextStep.trim()+delivery+'\n\nPodemos retomar o próximo passo em uma nova conversa.':value.text.trim().replace(/\s*\[ENCERRAR\]\s*$/,'')+delivery;
 const reported=users.map(u=>u.content).join(' ').toLowerCase();
 if(/(?:expõe|produziu|gerou|houve|revela)\s+(?:uma\s+)?ruptura[^.!?]*segurança psicológica/i.test(text)&&!reported.includes('ruptura'))throw new Error('UNSUPPORTED_FACT');
 if(/(?:medo|desconfiança)[^.!?]*permanecem/i.test(text)&&!reported.includes('medo')&&!reported.includes('desconfiança'))throw new Error('UNSUPPORTED_FACT');
 if(profile.id==='FBK'){for(const target of ['planejamento','andamento'])if(new RegExp('(?:comprometeu|compromete|afetou|prejudicou)[^.!?]*'+target,'i').test(text)&&!reported.includes(target))throw new Error('UNSUPPORTED_FACT');if(/(?:atrasos seguidos|duas últimas entregas)/i.test(text)&&!/(?:seguidos|consecutiv|últimas)/i.test(reported))throw new Error('UNSUPPORTED_FACT');}
 if(/(?:fortalece|fortalecer)[^.!?]*quem sobrevive|retirar limites só fortalece|exclui quem não aguenta/i.test(text))throw new Error('UNSUPPORTED_FACT');
 return {text,progress:{agent:profile.id,stage:value.stage,completed,pending:[...value.pending],lenses:[...value.lenses],deliveryKind,closingSummary:terminal?value.closingSummary:null,nextStep:terminal?value.nextStep:null,evidenceStatus:'Quotes verified against user messages; interpretation remains a hypothesis',version:'0.2.0'}};
}
function closingFallback(agent,messages){
 const last=messages.filter(x=>x.role==='user').at(-1)?.content??'';
 const excerpt=last.replace(/\s+/g,' ').replace(/\?/g,'.').slice(0,180);
 const next={MNT:'retomar as alternativas e a informação que falta antes de escolher',CTN:'priorizar uma pausa segura e retomar a decisão quando houver clareza',PRF:'retomar exemplos concretos que sustentem ou contradigam a recorrência',IMP:'retomar a diferença entre o efeito observado e a interpretação',FBK:'retomar os fatos e a mensagem que precisa ser comunicada',OTO:'retomar o compromisso que precisa ficar definido',CRS:'priorizar segurança e apoio humano adequado'};
 return `Não consegui consolidar uma conclusão segura nesta conversa. Seu ponto mais recente foi: “${excerpt}”. O próximo passo é ${next[agent]??'retomar o contexto específico e a ajuda de liderança necessária'}. As informações que faltam continuam pendentes; não vou preencher essas lacunas com suposições. Podemos retomar isso em uma nova conversa.`;
}
module.exports={turnDirective,validateProgress,closingFallback,STAGES};
