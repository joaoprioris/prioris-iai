import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pool} from '@workspace/db';
import authRouter from '../artifacts/api-server/src/routes/auth';
import sessionsRouter from '../artifacts/api-server/src/routes/sessions';
import {requireAuth,type AuthenticatedRequest} from '../artifacts/api-server/src/middlewares/auth';
import {createFunctionalRouter,createModelProviders} from '../artifacts/api-server/src/routes/functional-orchestrator';
if(!process.env.DATABASE_URL?.includes('.prioris-auth-test'))throw Error('ISOLATED_DATABASE_REQUIRED');
const root=path.resolve('.prioris-auth-test'),identity=JSON.parse(fs.readFileSync(path.join(root,'pilot-identity.json'),'utf8'));
let spent=0,reserved=0;const cap=0.25;const model=createModelProviders({onUsage:(kind,u)=>{const rates=kind==='haiku'?[1,5]:[3,15];spent+=(u.input_tokens*rates[0]+u.output_tokens*rates[1]+(u.cache_creation_input_tokens||0)*rates[0]*1.25+(u.cache_read_input_tokens||0)*rates[0]*0.1)/1e6;fs.writeFileSync(path.join(root,'pilot-usage.json'),JSON.stringify({synthetic:true,estimatedUSD:spent,capUSD:cap}));}});
async function bounded(kind:'haiku'|'sonnet',payload:any,fn:(p:any)=>Promise<any>){const rates=kind==='haiku'?[1,5]:[3,15],maxOutput=kind==='haiku'?600:1600;
 const reservation=((Buffer.byteLength(JSON.stringify(payload),'utf8')+10000)*rates[0]+maxOutput*rates[1])/1e6;
 if(spent+reserved+reservation>cap)throw Error('PILOT_BUDGET_GUARD');reserved+=reservation;try{return await fn(payload)}finally{reserved-=reservation}}
const app=express();app.disable('x-powered-by');app.use(cookieParser());app.use(express.json({limit:'32kb'}));
app.use((req,res,next)=>{req.log={info:()=>{},warn:()=>{},error:()=>{}} as any;res.setHeader('Cache-Control','no-store');next()});
app.post('/api/auth/request',(_req,res)=>{res.status(403).json({error:'Este piloto usa somente um acesso fictício temporário. Não envia e-mails.'})});
app.use('/api',authRouter);
const authorize=async(req:AuthenticatedRequest,res:express.Response,next:express.NextFunction)=>{await requireAuth(req,res,()=>{if(req.user?.id!==identity.userId||req.user?.organizationId!==identity.organizationId){res.status(403).json({error:'Acesso restrito à identidade fictícia do piloto.'});return}next()})};
app.use('/api/sessions',authorize);app.use('/api',sessionsRouter);
app.use('/api',createFunctionalRouter({authorize,enabled:()=>true,classify:async(p:any)=>bounded('haiku',p,model.classify),respond:async(p:any)=>bounded('sonnet',p,model.respond)}));
const dist=path.resolve('artifacts/iai-web/dist/public'),originalHtml=fs.readFileSync(path.join(dist,'index.html'),'utf8'),html=originalHtml.replace(/<body(?:\s[^>]*)?>/i,m=>m+'<style>body{padding-top:42px;box-sizing:border-box}#root>div{height:calc(100dvh - 42px)!important}</style><div style="position:fixed;top:0;left:0;width:100%;height:42px;box-sizing:border-box;z-index:9999;padding:6px 10px;background:#473318;color:white;font:14px Arial">PILOTO FICTÍCIO — use apenas situações inventadas. Versão pública inalterada.</div>');
if(originalHtml===html)throw Error('PILOT_NOTICE_MISSING');
app.use(express.static(dist,{index:false}));app.get('/',(_req,res)=>res.type('html').send(html));
const server=app.listen(3000,'0.0.0.0',()=>console.log('PILOTO_FICTICIO_PRONTO'));
async function stop(){server.close(async()=>{await pool.end();const savedPorts=path.join(root,'pilot-port-backup.json');if(fs.existsSync(savedPorts)){let configuration=fs.readFileSync('.replit','utf8');for(const pair of JSON.parse(fs.readFileSync(savedPorts,'utf8')).blocks)configuration=configuration.replace(pair.modified,pair.original);fs.writeFileSync('.replit',configuration);}if(process.env.PRIORIS_PILOT_OWNS_POSTGRES==='true'){try{execFileSync('pg_ctl',['-D',path.join(root,'pgdata'),'-m','fast','-w','stop'],{stdio:'ignore'})}catch{}}process.exit(0)})}
setTimeout(()=>{void stop()},60*60*1000);process.on('SIGTERM',()=>{void stop()});
