'use strict';
// Lexical fidelity guard, not semantic routing. Inspect affirmative finite verbs,
// not infinitives, future/conditional forms or explicitly negated assertions.
function affirmativeHistory(sentence){
 const parts=sentence.split(/\b(?:mas|porém|contudo)\b|[;:]/i);
 return parts.some(part=>{
  const matches=part.matchAll(/\b(?:ofereci|apresentei|mostrei|sugeri|(?:você|vocês)\s+(?:assumiu|aceitou|confirmou|validou|executou|já alinhou)|frases oferecidas|opções (?:oferecidas|anteriores)|prazo que voc[eê] assumiu)\b/gi);
  return [...matches].some(m=>{
   const prefix=part.slice(0,m.index).split(/,\s*|\be\b/i).at(-1);
   return !/\b(?:não|nunca|jamais|nem|se|talvez)\b[^.!?]*$/i.test(prefix)&&!part.trim().endsWith('?');
  });
 });
}
module.exports={affirmativeHistory};
