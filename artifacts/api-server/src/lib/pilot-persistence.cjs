'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {durableIO}=require('./pilot-durable-io.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
function processIdentity(pid){
 try{
  const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');
  return fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()+':'+stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 }catch{return null;}
}
function createPilotPersistence(file,state){
 file=path.resolve(file);
 function io(action,input={}){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const run=spawnSync('flock',['--exclusive','--wait','2',file+'.guard',process.execPath,'-e','('+durableIO.toString()+')(require)',file,action],{
   input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024,
  });
  let output;try{output=JSON.parse(run.stdout||'{}');}catch{}
  if(run.status!==0||!output||output.error){
   const message=output?.error||'STORAGE_UNAVAILABLE';
   const code=action==='acquire'&&['TURN_IN_PROGRESS','LOCK_OWNER_UNKNOWN'].includes(message)?message:'STORAGE_UNAVAILABLE';
   throw Object.assign(Error(message),{code});
  }
  return output.result;
 }
 const read=()=>io('read');
 let expected=null;const writer=randomUUID();
 if(read()!==null)refresh();
 function save(){
  const serialized=JSON.stringify(state);io('save',{expected,next:serialized});expected=serialized;
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
  io('acquire',{writer,pid:process.pid,processIdentity:processIdentity(process.pid)});
  return ()=>io('release',{writer});
 }
 function requestActive(){
  return io('active');
 }
 return {save,refresh,acquireRequest,requestActive,sha};
}
module.exports={createPilotPersistence};
