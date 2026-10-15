'use strict';
// Self-contained: executed under Linux flock in a separate, short-lived process.
function durableIO(require){
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const [file,action]=process.argv.slice(1),dir=path.dirname(file);
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const read=p=>{try{return fs.readFileSync(p,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const syncDir=p=>{const fd=fs.openSync(p,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
 function atomic(p,body){
  const temp=p+'.'+crypto.randomUUID()+'.tmp',fd=fs.openSync(temp,'wx',0o600);
  try{fs.writeFileSync(fd,body);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,p);syncDir(path.dirname(p));
 }
 function identity(pid){
  try{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()+':'+s.slice(s.lastIndexOf(')')+2).split(' ')[19];}catch{return null;}
 }
 function archiveLock(p){
  if(!fs.existsSync(p))return false;
  const raw=read(p+'/owner.json');
  if(!raw)throw Error('LOCK_OWNER_UNKNOWN');
  const owner=JSON.parse(raw);
  if(!owner.processIdentity||!Number.isInteger(owner.pid))throw Error('LOCK_OWNER_UNKNOWN');
  if(identity(owner.pid)===owner.processIdentity)throw Error('TURN_IN_PROGRESS');
  // Failure to inspect a still-existing PID is not evidence of termination.
  if(identity(owner.pid)===null&&fs.existsSync('/proc/'+owner.pid))throw Error('LOCK_OWNER_UNKNOWN');
  fs.mkdirSync(dir+'/lock-recovery',{recursive:true,mode:0o700});
  fs.renameSync(p,dir+'/lock-recovery/'+path.basename(p)+'.'+crypto.randomUUID());
  syncDir(dir+'/lock-recovery');syncDir(dir);return true;
 }
 try{
  const input=JSON.parse(fs.readFileSync(0,'utf8')||'{}');
  // Recover an acknowledged write intent before allowing any state read/write.
  const pending=read(file+'.pending');
  if(pending){
   const j=JSON.parse(pending),current=read(file);
   if(hash(j.next)!==j.nextHash)throw Error('JOURNAL_CORRUPT');
   JSON.parse(j.next);
   if(current!==j.next){
    if((current===null?null:hash(current))!==j.previousHash)throw Error('JOURNAL_CONFLICT');
    atomic(file,j.next);
   }
   fs.unlinkSync(file+'.pending');syncDir(dir);
  }
  let result;
  if(action==='read')result=read(file);
  else if(action==='save'){
   // Legacy write locks are recovered only with demonstrably dead owners.
   archiveLock(file+'.write-lock');
   const current=read(file);
   if(current!==input.expected)throw Error('STATE_CONFLICT');
   JSON.parse(input.next);
   const snapshots=dir+'/snapshots';fs.mkdirSync(snapshots,{recursive:true,mode:0o700});syncDir(dir);
   const snapshot=snapshots+'/'+hash(input.next)+'.json',existing=read(snapshot);
   if(existing!==null&&existing!==input.next)throw Error('SNAPSHOT_CORRUPT');
   if(existing===null)atomic(snapshot,input.next);
   atomic(file+'.pending',JSON.stringify({previousHash:current===null?null:hash(current),nextHash:hash(input.next),next:input.next}));
   atomic(file,input.next);
   fs.unlinkSync(file+'.pending');syncDir(dir);result=true;
  }else if(action==='active'){
   const p=file+'.request-lock';
   try{archiveLock(p);result=false;}catch(e){if(e.message==='TURN_IN_PROGRESS'||e.message==='LOCK_OWNER_UNKNOWN')result=true;else throw e;}
  }else if(action==='acquire'){
   const p=file+'.request-lock';
   archiveLock(p);
   fs.mkdirSync(p,{mode:0o700});syncDir(dir);
   atomic(p+'/owner.json',JSON.stringify(input));result=true;
  }else if(action==='release'){
   const p=file+'.request-lock',owner=JSON.parse(read(p+'/owner.json')||'null');
   if(owner?.writer!==input.writer)throw Error('REQUEST_LOCK_CHANGED');
   // Preserve ownership evidence; do not create an unowned half-deleted lock.
   fs.mkdirSync(dir+'/lock-recovery',{recursive:true,mode:0o700});
   fs.renameSync(p,dir+'/lock-recovery/completed.'+crypto.randomUUID());
   syncDir(dir+'/lock-recovery');syncDir(dir);result=true;
  }else throw Error('INVALID_STORAGE_ACTION');
  process.stdout.write(JSON.stringify({result}));
 }catch(e){process.stdout.write(JSON.stringify({error:e.message}));process.exitCode=1;}
}
module.exports={durableIO};
