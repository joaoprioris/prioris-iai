'use strict';
// Output fidelity checks, never an agent selector or a claim of semantic truth.
const normalize=s=>s.toLocaleLowerCase('pt-BR').replace(/[“”"'‘’]/g,'').replace(/\s+/g,' ').trim();
const TIMES=/\b(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?\b|\b(?:hoje|amanhã|agora|imediatamente)\b|\b\d{1,2}(?::\d{2}|h(?:\d{2})?)\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi;
const COMMIT=/\b(?:assum\w*|retorn\w*|volt\w*|confirm\w*|valid\w*|chec\w*|entreg\w*|alinhe|alinhar|alinha)\b/i;
function validateGrounding(value,messages,visibleParts){
 const claims=value.operationalClaims??[];
 if(!Array.isArray(claims)||claims.length>12)throw Error('UNSUPPORTED_FACT');
 const byRole={user:messages.filter(m=>m.role==='user'),assistant:messages.filter(m=>m.role==='assistant')};
 for(const claim of claims){
  if(!claim||!['time_commitment','viability','execution','prior_assistant_content'].includes(claim.kind)||!['user','assistant'].includes(claim.role)||!Number.isInteger(claim.message)||typeof claim.quote!=='string'||!claim.quote.trim()||typeof claim.text!=='string'||!claim.text.trim())throw Error('UNSUPPORTED_FACT');
  const source=byRole[claim.role][claim.message]?.content;
  if(typeof source!=='string'||!source.includes(claim.quote)||!visibleParts.some(p=>p.includes(claim.text)))throw Error('UNSUPPORTED_FACT');
  if(claim.kind==='prior_assistant_content'&&claim.role!=='assistant')throw Error('UNSUPPORTED_FACT');
  if(claim.kind!=='prior_assistant_content'&&claim.role!=='user')throw Error('UNSUPPORTED_FACT');
 }
 const users=byRole.user.map(m=>m.content).join('\n');
 const assistants=byRole.assistant.map(m=>m.content).join('\n');
 // Proposed dates are commitments too. Mentioning a date in a question or in
 // a statement of uncertainty is not acceptance/viability of that date.
 for(const part of visibleParts){
  for(const sentence of part.split(/(?<=[.!?\n])\s*/)){
   if(/\b(?:prazo|data)s?\b/i.test(sentence)&&/\b(?:qual|que)\b/i.test(sentence)&&/(?:prefere|preferem|funciona melhor|mais conveniente)/i.test(sentence)&&!claims.some(c=>c.kind==='viability'&&sentence.includes(c.text)&&/\b(?:viáveis|viável|confirmadas|confirmados)\b/i.test(c.quote)&&!/\b(?:não|sem|talvez)\b/i.test(c.quote)))throw Error('UNSUPPORTED_FACT');
   const times=sentence.match(TIMES)??[];
   if(COMMIT.test(sentence)&&times.length){
    const supported=claims.some(c=>c.kind==='time_commitment'&&sentence.includes(c.text)&&times.every(t=>normalize(c.quote).includes(normalize(t)))&&/\b(?:posso|consigo|vou|assumo|assumi|combinamos|confirmamos|me comprometo)\b/i.test(c.quote)&&!/\b(?:não|sem|talvez|se)\b/i.test(c.quote));
    if(!supported)throw Error('UNSUPPORTED_FACT');
   }
   if(/prazo que voc[eê] assumiu|voc[eê] (?:assumiu|aceitou|confirmou|validou|executou|já alinhou)/i.test(sentence)&&!claims.some(c=>c.kind==='execution'&&sentence.includes(c.text)&&users.includes(c.quote)))throw Error('UNSUPPORTED_FACT');
   if(/(?:ofereci|apresentei|mostrei|sugeri|frases oferecidas|opções (?:oferecidas|anteriores))/i.test(sentence)){
    const supporting=claims.filter(c=>c.kind==='prior_assistant_content'&&sentence.includes(c.text)&&assistants.includes(c.quote));
    if(!supporting.length)throw Error('UNSUPPORTED_FACT');
    if(/\bduas\b/i.test(sentence)&&new Set(supporting.map(c=>c.quote)).size<2)throw Error('UNSUPPORTED_FACT');
   }
  }
 }
 return structuredClone(claims);
}
function rejectDuplicateDelivery(parts,delivery){
 if(!delivery)return;
 const target=normalize(delivery);
 if(parts.some(p=>normalize(p).includes(target)))throw Error('DUPLICATE_DELIVERY');
}
module.exports={validateGrounding,rejectDuplicateDelivery};
