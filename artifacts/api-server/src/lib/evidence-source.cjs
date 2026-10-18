'use strict';
// Presentation-only normalization: no case folding, paraphrase, accent removal,
// punctuation removal or semantic matching. Offsets recover the exact source.
function presentation(source){
 let text='',start=[],end=[];
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(/\s/u.test(c)){
   if(text.endsWith(' ')){end[end.length-1]=i+1;continue;}
   text+=' ';start.push(i);end.push(i+1);
  }else{
   text+=/[“”„«»‘’"']/u.test(c)?'"':c;
   start.push(i);end.push(i+1);
  }
 }
 return {text,start,end};
}
function locatePresentation(source,quote){
 const normalized=presentation(source),target=presentation(quote).text.trim();
 if(!target)return [];
 const found=[];
 for(let at=normalized.text.indexOf(target);at!==-1;at=normalized.text.indexOf(target,at+target.length)){
  const start=normalized.start[at],end=normalized.end[at+target.length-1];
  found.push({start,end,quote:source.slice(start,end)});
 }
 return found;
}
function resolveUserEvidence(reference,messages){
 if(!reference||!Number.isSafeInteger(reference.message)||reference.message<0||typeof reference.quote!=='string'||reference.quote.trim().length<5||reference.quote.length>240)throw Error('INVALID_PROGRESS_EVIDENCE');
 const users=messages.flatMap((m,i)=>m.role==='user'?[{content:m.content,conversationIndex:i}]:[]);
 const declared=users[reference.message];
 let message,quote;
 if(typeof declared?.content==='string'&&declared.content.includes(reference.quote)){
  message=reference.message;quote=reference.quote;
 }else{
  const exact=users.flatMap((u,i)=>typeof u.content==='string'&&u.content.includes(reference.quote)?[{message:i,quote:reference.quote}]:[]);
  if(exact.length===1)({message,quote}=exact[0]);
  else if(exact.length>1)throw Error('INVALID_PROGRESS_EVIDENCE');
  else{
   const matches=users.flatMap((u,i)=>typeof u.content==='string'?locatePresentation(u.content,reference.quote).map(m=>({message:i,quote:m.quote})):[]);
   if(matches.length!==1||matches[0].quote.length>240)throw Error('INVALID_PROGRESS_EVIDENCE');
   ({message,quote}=matches[0]);
  }
 }
 const changed=message!==reference.message||quote!==reference.quote;
 return {
  evidence:{message,quote},
  normalization:changed?{raw:{message:reference.message,quote:reference.quote},resolved:{message,quote},sourceRole:'user',sourceConversationIndex:users[message].conversationIndex,reason:quote!==reference.quote?'presentation_and_reference':'reference_only'}:null,
 };
}
function deduplicateDelivery(parts,delivery,options={}){
 if(!delivery)return {parts:[...parts],append:false,normalizations:[]};
 if(options.separate===true){
  const normalizations=[];
  const clean=parts.map((part,i)=>{
   const matches=locatePresentation(part,delivery);
   for(const match of matches.reverse()){
    let {start,end}=match;
    const pairs={'"':'"','“':'”','«':'»','‘':'’'};
    if(start>0&&pairs[part[start-1]]===part[end]){start--;end++;}
    part=part.slice(0,start)+part.slice(end);
    normalizations.push({kind:'delivery_moved_to_separate_field',part:i});
   }
   return part.trim();
  });
  return {parts:clean,append:true,normalizations};
 }
 let seen=false;
 const normalizations=[];
 const clean=parts.map((part,i)=>{
  const matches=locatePresentation(part,delivery),remove=[];
  for(const match of matches){
   if(!seen){seen=true;normalizations.push({kind:'delivery_already_visible',part:i});}
   else {remove.push(match);normalizations.push({kind:'repeated_delivery_removed',part:i});}
  }
  for(const match of remove.reverse())part=part.slice(0,match.start)+part.slice(match.end);
  return part.trim();
 });
 return {parts:clean,append:!seen,normalizations};
}
module.exports={resolveUserEvidence,locatePresentation,deduplicateDelivery};
