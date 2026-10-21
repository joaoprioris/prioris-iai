'use strict';
// Actual admin route, synthetic persistence. Never sends mail or creates real users.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const esbuild=require(path.resolve('artifacts/api-server/node_modules/esbuild'));
const stub=path.join(__dirname,'admin-database-fixture.ts'),entry=path.join(__dirname,'admin-fixture-entry.ts');
fs.writeFileSync(stub,`export {usersTable,organizationsTable} from '../lib/db/src/schema/index.ts';
export const state:any={queue:[],writes:[]};
export const db:any={select:()=>({from:()=>({where:async()=>state.queue.shift()??[]})}),insert:()=>({values:(v:any)=>{state.writes.push(v);return{returning:async()=>[{id:'11111111-1111-4111-8111-111111111111'}]}}}),update:()=>{throw Error('SESSION_CREDENTIAL_MUST_NOT_BE_REPLACED')}};`);
fs.writeFileSync(entry,"export {default as router} from '../artifacts/api-server/src/routes/admin';export {state} from './admin-database-fixture';");
esbuild.buildSync({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',packages:'external',alias:{'@workspace/db':stub},outfile:path.join(__dirname,'admin-fixture-bundle.cjs')});
const {router,state}=require('./admin-fixture-bundle.cjs'),express=require(path.resolve('artifacts/api-server/node_modules/express'));
const originalToken=process.env.ADMIN_TOKEN;process.env.ADMIN_TOKEN='synthetic-test-token-not-a-secret';
const app=express();app.use(express.json());app.use((req,res,next)=>{req.log={info:()=>{},error:()=>{}};next()});app.use(router);
const org='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const result={synthetic:true,persistence:'fixture',checks:[]};let server;
async function check(name,fn){try{await fn();result.checks.push({name,pass:true})}catch(e){result.checks.push({name,pass:false,errorType:e.name});console.log('FAIL',name,e.message)}}
(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 const post=(body,token=process.env.ADMIN_TOKEN)=>fetch(base+'/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
 await check('invalid admin credential rejected',async()=>assert.equal((await post({email:'synthetic@example.invalid',organization_id:org},'wrong-token')).status,401));
 await check('invalid email rejected',async()=>assert.equal((await post({email:'bad',organization_id:org})).status,400));
 await check('missing organization rejected',async()=>assert.equal((await post({email:'synthetic@example.invalid'})).status,400));
 await check('unknown organization rejected',async()=>{state.queue=[[]];assert.equal((await post({email:'synthetic@example.invalid',organization_id:org})).status,404)});
 await check('existing same-tenant user preserves login state',async()=>{state.queue=[[{id:org,name:'Fictitious'}],[{id:'11111111-1111-4111-8111-111111111111',organizationId:org}]];const r=await post({email:'synthetic@example.invalid',organization_id:org});assert.equal(r.status,200);const d=await r.json();assert.equal(d.loginRequired,true);assert.equal(d.token,undefined);assert.equal(d.magicLink,undefined);assert.equal(state.writes.length,0)});
 await check('cross-tenant email reuse rejected',async()=>{state.queue=[[{id:org,name:'Fictitious'}],[{id:'11111111-1111-4111-8111-111111111111',organizationId:other}]];assert.equal((await post({email:'synthetic@example.invalid',organization_id:org})).status,409);assert.equal(state.writes.length,0)});
 await check('new user has no issued credential or link',async()=>{state.queue=[[{id:org,name:'Fictitious'}],[]];const r=await post({email:' SYNTHETIC@example.invalid ',organization_id:org});assert.equal(r.status,201);const d=await r.json();assert.equal(d.token,undefined);assert.equal(d.magicLink,undefined);assert.equal(state.writes.length,1);assert.equal(state.writes[0].authToken,null);assert.equal(state.writes[0].email,'synthetic@example.invalid')});
})().catch(e=>{result.fatal={errorType:e.name,message:e.message}}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(originalToken===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=originalToken;fs.writeFileSync(path.join(__dirname,'admin-provisioning-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:result.checks.length,passed:result.checks.filter(c=>c.pass).length,fatal:!!result.fatal}));process.exit(result.fatal||result.checks.some(c=>!c.pass)?1:0)});
