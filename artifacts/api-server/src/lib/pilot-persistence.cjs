'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
function processIdentity(pid){
 try{
  const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');
  return fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()+':'+stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 }catch{return null;}
}
function createPilotPersistence(file,state){
 const read=()=>{try{return fs.readFileSync(file,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 let expected=read();const writer=randomUUID();
 const writeLock=file+'.write-lock',requestLock=file+'.request-lock';
 function save(){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  try{fs.mkdirSync(writeLock,{mode:0o700});}catch{throw Object.assign(Error('STATE_WRITE_BUSY'),{code:'STORAGE_UNAVAILABLE'});}
  try{
   const actual=read();if(actual!==expected)throw Error('STATE_CONFLICT');
   const serialized=JSON.stringify(state),directory=path.dirname(file)+'/snapshots';
   fs.mkdirSync(directory,{recursive:true,mode:0o700});
   const snapshot=directory+'/'+sha(serialized)+'.json';
   try{fs.writeFileSync(snapshot,serialized,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
   const temp=file+'.'+writer+'.tmp';
   fs.writeFileSync(temp,serialized,{flag:'w',mode:0o600});fs.renameSync(temp,file);expected=serialized;
  }catch(err){err.code='STORAGE_UNAVAILABLE';throw err;}
  finally{fs.rmdirSync(writeLock);}
 }
 function refresh(){
  const raw=read();if(raw===null)throw Error('PILOT_STATE_MISSING');
  if(raw===expected)return false;
  const next=JSON.parse(raw),budget=state.budget;
  // Keep the budget closure attached to the current canonical budget object.
  for(const k of Object.keys(state))delete state[k];
  Object.assign(state,next);
  if(budget&&next.budget){for(const k of Object.keys(budget))delete budget[k];Object.assign(budget,next.budget);state.budget=budget;}
  expected=raw;return true;
 }
 function acquireRequest(){
  try{fs.mkdirSync(requestLock,{mode:0o700});}catch{throw Error('TURN_IN_PROGRESS');}
  fs.writeFileSync(requestLock+'/owner.json',JSON.stringify({writer,pid:process.pid,processIdentity:processIdentity(process.pid)}),{mode:0o600});
  return ()=>{
   const owner=JSON.parse(fs.readFileSync(requestLock+'/owner.json','utf8'));
   if(owner.writer!==writer)throw Error('REQUEST_LOCK_CHANGED');
   fs.unlinkSync(requestLock+'/owner.json');fs.rmdirSync(requestLock);
  };
 }
 function requestActive(){
  if(!fs.existsSync(requestLock))return false;
  try{
   const owner=JSON.parse(fs.readFileSync(requestLock+'/owner.json','utf8'));
   if(owner.processIdentity && processIdentity(owner.pid)!==owner.processIdentity)return false;
  }catch{return true;}
  return true;
  // An orphan lock is still retained by acquireRequest: recognizing local
  // termination doesn't authorize another remote call or release its reserve.
 }
 return {save,refresh,acquireRequest,requestActive,sha};
}
module.exports={createPilotPersistence};
