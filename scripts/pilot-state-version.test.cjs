'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {prepareFifthRound,prepareIndependentRound,PILOT_STATE_VERSION}=require('../artifacts/api-server/src/lib/pilot-rounds.cjs');
const {ROUTING_VERSION}=require('../artifacts/api-server/src/lib/functional-policy.cjs');
const fixture=version=>({version,round:20,provider:'replit',expiresAt:1,realCallsSuspended:true,budget:{cap:5000000,charged:5000000,blocked:true,calls:[{status:'uncertain-held',reservedMicroUSD:700000}]},audit:[{outcome:'failed'}],requests:{previous:'preserved'},archivedRounds:[],session:{status:'closed',exchangeCount:2,context:{messages:[{role:'user',content:'Fictício.'}]}},delivery:{old:{status:'uncertain'}}});
for(const version of ['0.3.4','0.3.4-EX04-1','0.3.4-EX04-2'])test('Revisão '+version+' reabre sem reescrever estado, suspensão, orçamento ou incerteza',()=>{
 const s=fixture(version),before=JSON.stringify(s);assert.equal(prepareFifthRound(s),s);assert.equal(JSON.stringify(s),before);assert.notEqual(ROUTING_VERSION,PILOT_STATE_VERSION);
});
test('Estado desconhecido ou estruturalmente inválido continua bloqueado',()=>{
 for(const version of ['0.3.4-EX04-unknown','0.3.5','0.3.3',undefined])assert.throws(()=>prepareFifthRound(fixture(version)),/PILOT_STATE_MISMATCH/);
 assert.throws(()=>prepareFifthRound({...fixture('0.3.4'),round:4}),/PILOT_STATE_MISMATCH/);
});
test('Próxima rodada usa esquema estável e preserva custo, reservas e arquivo anterior',()=>{
 const s=fixture('0.3.4-EX04-2'),before=JSON.stringify(s);const next=prepareIndependentRound(s,1000);
 assert.equal(JSON.stringify(s),before);assert.equal(next.version,PILOT_STATE_VERSION);assert.equal(next.round,21);assert.deepEqual(next.budget.calls,s.budget.calls);assert.equal(next.budget.charged,5000000);assert.equal(next.budget.blocked,true);assert.equal(next.archivedRounds[0].original.delivery.old.status,'uncertain');
 assert.throws(()=>prepareIndependentRound({...s,budget:{...s.budget,calls:[{status:'reserved'}]}}),/PILOT_STATE_MISMATCH/);
});
test('API reabre ledger anterior sem chamada ao provedor ou alteração do arquivo',async()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
 const api=Module.createRequire(path.resolve('artifacts/api-server/package.json'));
 const built=api('esbuild').buildSync({entryPoints:['artifacts/api-server/src/routes/pilot.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,alias:{'@workspace/db':path.resolve('scripts/db-denied-fixture.ts')}});
 const filename=path.resolve('artifacts/api-server/fixture-schema.cjs');const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(built.outputFiles[0].text,filename);
 const keys=['NODE_ENV','REPLIT_DEV_DOMAIN','PRIORIS_AI_PROVIDER'];const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{NODE_ENV:'development',REPLIT_DEV_DOMAIN:'fixture.example.invalid',PRIORIS_AI_PROVIDER:'replit'});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iai-schema-'));const file=path.join(dir,'state.json');let server;
 try{
  const s=fixture('0.3.4');s.budget.calls=[];s.session=undefined;fs.writeFileSync(file,JSON.stringify(s));const original=fs.readFileSync(file);
  const deny=new Proxy({}, {get(){throw Error('PROVIDER_MUST_NOT_BE_USED');}});const router=m.exports.createPilotRouter({stateFile:file,client:deny});const app=api('express')();app.use(api('cookie-parser')());app.use(router);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/status');assert.equal(response.status,200);const result=await response.json();assert.equal(result.version,ROUTING_VERSION);assert.equal(result.round,20);assert.equal(result.realCallsSuspended,true);assert.equal(result.available,false);assert.equal(result.budget.remainingUSD,0);assert.deepEqual(fs.readFileSync(file),original);
 }finally{if(server)await new Promise(r=>server.close(r));for(const k of keys){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}fs.rmSync(dir,{recursive:true,force:true});}
});
