'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const modulePath=path.resolve('artifacts/api-server/src/lib/pilot-persistence.cjs');
const {createPilotPersistence}=require(modulePath);
const {createPilotDelivery}=require('../artifacts/api-server/src/lib/pilot-delivery.cjs');
const dirs=[];
const fixture=()=>({budget:{charged:4321000,calls:[{status:'reserved',reservedMicroUSD:75000}]},
 session:{id:'fictional',status:'active',exchangeCount:1},requests:{},
 delivery:{'fictional-send':{requestId:'fictional-send',status:'processing',content:'Fictício.',
 contentHash:require('node:crypto').createHash('sha256').update('Fictício.').digest('hex')}},
 audit:[{outcome:'completed',result:{text:'Resposta fictícia anterior.'}}]});
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iai-durable-'));dirs.push(dir);
 const file=dir+'/state.json';fs.writeFileSync(file,JSON.stringify(fixture()));return {dir,file};
}
function run(file,body,env={}){
 return spawnSync(process.execPath,['-e',`const fs=require('node:fs');const file=process.argv[1];const {createPilotPersistence}=require(${JSON.stringify(modulePath)});const s=JSON.parse(fs.readFileSync(file));const p=createPilotPersistence(file,s);${body}`,file],{
  encoding:'utf8',env:{...process.env,...env},timeout:15000,
 });
}
function fault(dir,file,mode){
 const hook=dir+'/fault.cjs';
 fs.writeFileSync(hook,`
const fs=require('node:fs');const rename=fs.renameSync,write=fs.writeFileSync;
fs.renameSync=function(a,b){const result=rename(a,b);if(b===${JSON.stringify(file+'.pending')}&&${JSON.stringify(mode)}==='journal')process.kill(process.pid,'SIGKILL');return result;};
fs.writeFileSync=function(p,data,...rest){const target=typeof p==='number'?fs.readlinkSync('/proc/self/fd/'+p):String(p);if(target.startsWith(${JSON.stringify(file+'.')})&&target.endsWith('.tmp')&&!target.includes('.pending.')&&${JSON.stringify(mode)}==='partial'){write(p,String(data).slice(0,10),...rest);process.kill(process.pid,'SIGKILL');}return write(p,data,...rest);};
`);
 return {NODE_OPTIONS:'--require='+hook};
}
test('Journal durable: SIGKILL after intent, fresh real process recovers response, receipt and full cost',()=>{
 const {dir,file}=setup();
 const r=run(file,`s.budget.charged=4400000;s.delivery['fictional-send'].status='completed';s.delivery['fictional-send'].result={text:'Resposta confirmada.'};s.requests['fictional-send']={text:'Resposta confirmada.'};p.save();`,fault(dir,file,'journal'));
 assert.notEqual(r.status,0);assert(fs.existsSync(file+'.pending'));
 const next=run(file,`assert=require('node:assert/strict');assert.equal(s.budget.charged,4400000);assert.equal(s.requests['fictional-send'].text,'Resposta confirmada.');assert.equal(s.delivery['fictional-send'].status,'completed');`);
 assert.equal(next.status,0,next.stderr);assert(!fs.existsSync(file+'.pending'));
});
test('Interrupted partial canonical temp write: journal completes without loss or duplicate charge',()=>{
 const {dir,file}=setup();const r=run(file,'s.budget.charged=4500000;p.save();',fault(dir,file,'partial'));
 assert.notEqual(r.status,0);assert.equal(JSON.parse(fs.readFileSync(file)).budget.charged,4321000);
 const r2=run(file,`if(s.budget.charged!==4500000||s.budget.calls.length!==1)throw Error('LOSS');p.save();`);
 assert.equal(r2.status,0,r2.stderr);
});
test('Concurrent real processes with stale state: exactly one write, no retrogression',async()=>{
 const {dir,file}=setup();
 const code=`const fs=require('node:fs'),{createPilotPersistence}=require(${JSON.stringify(modulePath)});const file=process.argv[1],s=JSON.parse(fs.readFileSync(file)),p=createPilotPersistence(file,s);process.stdout.write('READY\\n');setTimeout(()=>{s.budget.charged=4500000;try{p.save();process.exit(0);}catch{process.exit(2);}},400);`;
 const start=()=>new Promise(resolve=>{
  const c=spawn(process.execPath,['-e',code,file],{stdio:['ignore','pipe','pipe']});
  c.on('exit',status=>resolve(status));
 });
 const statuses=await Promise.all([start(),start()]);
 assert.deepEqual(statuses.sort(),[0,2]);assert.equal(JSON.parse(fs.readFileSync(file)).budget.charged,4500000);
});
test('Live request survives observer restart; SIGKILL owner archives lock, keeps uncertain send and reserve',async()=>{
 const {file,dir}=setup();
 const c=spawn(process.execPath,['-e',`const fs=require('node:fs'),{createPilotPersistence}=require(${JSON.stringify(modulePath)});const p=createPilotPersistence(process.argv[1],JSON.parse(fs.readFileSync(process.argv[1])));p.acquireRequest();process.stdout.write('READY');setInterval(()=>{},1000);`,file],{stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{c.stdout.once('data',resolve);c.once('error',reject);});
 const s=fixture(),p=createPilotPersistence(file,s);
 assert(p.requestActive());assert.throws(()=>p.acquireRequest(),/TURN_IN_PROGRESS/);
 c.kill('SIGKILL');await new Promise(resolve=>c.once('exit',resolve));
 assert.equal(p.requestActive(),false);assert(fs.readdirSync(dir+'/lock-recovery').length);
 const before=JSON.stringify(s.budget);const delivery=createPilotDelivery(s,()=>p.save());delivery.recoverRestart();
 assert.equal(s.delivery['fictional-send'].status,'uncertain');assert.equal(JSON.stringify(s.budget),before);
 assert(delivery.begin({sessionId:'fictional',requestId:'fictional-send',content:'Fictício.'},false).replay);
 assert.equal(s.budget.calls.length,1);
});
test('Unverifiable lock owner is never removed',()=>{
 const {file}=setup();fs.mkdirSync(file+'.request-lock');
 const p=createPilotPersistence(file,fixture());assert(p.requestActive());assert.throws(()=>p.acquireRequest(),/LOCK_OWNER_UNKNOWN/);
 assert(fs.existsSync(file+'.request-lock'));
});
test('Conflicting journal fails closed and preserves all evidence',()=>{
 const {file}=setup();const before=fs.readFileSync(file);
 fs.writeFileSync(file+'.pending',JSON.stringify({previousHash:'wrong',nextHash:'wrong',next:'{}'}));
 assert.throws(()=>createPilotPersistence(file,fixture()),/JOURNAL_CORRUPT/);
 assert.deepEqual(fs.readFileSync(file),before);assert(fs.existsSync(file+'.pending'));
});
test('Copy backup/restore into separate directory retains receipts, response, audit and reserve',()=>{
 const {file,dir}=setup();const s=fixture(),p=createPilotPersistence(file,s);p.save();
 const restore=dir+'/restored';fs.mkdirSync(restore);fs.copyFileSync(file,restore+'/state.json');
 const restored={};createPilotPersistence(restore+'/state.json',restored);
 assert.deepEqual(restored,s);
});
test('Missing flock fails closed, not unlocked writes',()=>{
 const {file}=setup();const r=run(file,'p.save();',{PATH:'/nonexistent'});
 assert.notEqual(r.status,0);assert.equal(JSON.parse(fs.readFileSync(file)).budget.charged,4321000);
});
test.after(()=>{for(const d of dirs)fs.rmSync(d,{recursive:true,force:true});});
