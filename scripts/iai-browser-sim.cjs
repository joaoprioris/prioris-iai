'use strict';
// Disposable browser harness: no changes to production/pilot authentication.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),prefix='/technical-sim';
if(!process.argv.includes('--worker')){
 const {fork}=require('node:child_process'),crypto=require('node:crypto');
 const historical=path.join(root,'generated-artifacts/pilot-campaign/state-v1.json');
 const digest=()=>crypto.createHash('sha256').update(fs.readFileSync(historical)).digest('hex');
 const before=digest();
 const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',
  PORT:process.env.PORT,REPLIT_DEV_DOMAIN:process.env.REPLIT_DEV_DOMAIN,NODE_ENV:'test',
  REPL_ID:'fictional-browser-rehearsal',REPL_OWNER_ID:'fictional-browser-owner',
  PRIORIS_AI_PROVIDER:'replit',AI_INTEGRATIONS_ANTHROPIC_API_KEY:'fictional-not-a-key',
  AI_INTEGRATIONS_ANTHROPIC_BASE_URL:'https://provider.example.invalid'};
 const child=fork(__filename,['--worker'],{env,stdio:['ignore','inherit','inherit','ipc']});
 child.on('message',message=>{
  if(message.ready){
   const unchanged=before===digest();
   const report={simulation:true,revision:'technical-step3',historicalStateUnchanged:unchanged,
    historicalSHA256:before,temporaryDirectory:message.dir,externalModelCalls:0,
    url:'https://'+env.REPLIT_DEV_DOMAIN+prefix+'/pilot-0.3.0'};
   const out=path.join(root,'generated-artifacts/browser-simulation');
   fs.mkdirSync(out,{recursive:true,mode:0o700});
   fs.writeFileSync(out+'/access.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
   if(!unchanged){child.kill('SIGTERM');throw Error('HISTORICAL_STATE_CHANGED');}
   console.log('SIMULATION_READY '+report.url+'; historical state unchanged');
  }
 });
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>process.exit(code??0));
}else{
 main().catch(error=>{console.error('SIMULATION_START_FAILED',error.message);process.exit(1);});
}
async function main(){
 // Deny network transports before importing any provider/application modules.
 globalThis.fetch=async()=>{throw Error('EXTERNAL_NETWORK_FORBIDDEN');};
 for(const name of ['node:http','node:https']){
  const transport=require(name);
  for(const method of ['request','get'])transport[method]=()=>{throw Error('EXTERNAL_NETWORK_FORBIDDEN');};
 }
 const {createRequire,Module}=require('node:module'),{pathToFileURL}=require('node:url');
 const api=createRequire(root+'/artifacts/api-server/package.json');
 const frontend=createRequire(root+'/artifacts/iai-web/package.json');
 const express=api('express'),cookies=api('cookie-parser');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iai-browser-sim-'));
 const entry=root+'/artifacts/api-server/src/routes/pilot.ts';
 // Existing dependency injection; default router is evaluated in test mode,
 // therefore it cannot initialize the historical campaign.
 const built=api('esbuild').buildSync({entryPoints:[entry],bundle:true,platform:'node',
  format:'cjs',packages:'external',write:false,
  alias:{'@workspace/db':root+'/scripts/db-denied-fixture.ts'}});
 const m=new Module(root+'/artifacts/api-server/browser-sim-fixture.cjs',module);
 m.filename=root+'/artifacts/api-server/browser-sim-fixture.cjs';
 m.paths=Module._nodeModulePaths(path.dirname(m.filename));m._compile(built.outputFiles[0].text,m.filename);
 process.env.NODE_ENV='development';
 const origin='https://'+process.env.REPLIT_DEV_DOMAIN;
 const app=express();app.disable('x-powered-by');app.set('trust proxy',true);
 app.use(express.json());app.use(express.urlencoded({extended:false}));app.use(cookies());
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 const states={},routers={};
 const {pilotIdentity}=require(root+'/artifacts/api-server/src/lib/pilot-next-round.cjs');
 for(const [name,round] of [['A',1001],['B',1002]]){
  const identity=pilotIdentity(round),id='10000000-0000-4000-8000-'+(name==='A'?'000000000001':'000000000002');
  const file=dir+'/'+name+'.json';states[name]={file,id};
  fs.writeFileSync(file,JSON.stringify({version:'0.3.4',round,provider:'replit',
   createdAt:Date.now(),expiresAt:Date.now()+7200000,requests:{},audit:[],archivedRounds:[],
   budget:{currentRound:round,cap:5000000,charged:0,calls:[],blocked:false},
   session:{id,userId:identity.id,organizationId:identity.organizationId,status:'active',
    agentType:'MNT',exchangeCount:0,context:{}}}),{mode:0o600});
  const auth={discovery:async()=>({}),randomPKCECodeVerifier:()=> 'fictional-verifier',
   randomNonce:()=> 'fictional-nonce',randomState:()=> 'fictional-state',
   calculatePKCECodeChallenge:async()=> 'fictional-challenge',
   buildAuthorizationUrl:()=>new URL(origin+prefix+'/api/pilot-0.3.0/callback'),
   authorizationCodeGrant:async()=>({claims:()=>({sub:'fictional-browser-owner'})})};
  const simulatedModel={
   classify:async()=>({scope:'leadership',job:'compare_paths',confidence:'high'}),
   respond:async()=>{await new Promise(resolve=>setTimeout(resolve,6000));
    return {text:'[SIMULAÇÃO TÉCNICA] Resposta determinística da identidade '+name+
     '. Não há interpretação por IA. Este conteúdo serve apenas para conferir envio e recuperação.'};},
  };
  routers[name]=m.exports.createPilotRouter({stateFile:file,oidcClient:auth,simulatedModel,
   client:{messages:{create:()=>{throw Error('EXTERNAL_PROVIDER_FORBIDDEN');}}}});
 }
 function sameOrigin(req,res,next){
  if(req.get('origin')!==origin)return res.status(403).send('Origem de teste recusada.');
  next();
 }
 const choice=req=>req.cookies.iai_sim_choice==='B'?'B':'A';
 app.post(prefix+'/choose',sameOrigin,(req,res)=>{
  if(!['A','B'].includes(req.body.identity))return res.sendStatus(400);
  // Switching tenant does not grant the new tenant's authentication cookie.
  res.cookie('iai_sim_choice',req.body.identity,{httpOnly:true,secure:true,sameSite:'lax',path:prefix,maxAge:7200000});
  res.redirect(prefix+'/pilot-0.3.0');
 });
 app.post(prefix+'/stop',sameOrigin,(req,res)=>{
  res.send('Ambiente fictício encerrado. App e piloto originais não foram alterados.');
  setTimeout(()=>shutdown(),250);
 });
 app.use(prefix+'/api/pilot-0.3.0',(req,res,next)=>{
  const selected=choice(req);
  // Translate only the isolated cookie paths and redirects. No normal-app routes.
  const cookie=res.cookie.bind(res),redirect=res.redirect.bind(res);
  res.cookie=(name,value,options)=>cookie('sim_'+selected+'_'+name,value,{...options,path:prefix+'/api/pilot-0.3.0'});
  res.clearCookie=(name,options)=>cookie('sim_'+selected+'_'+name,'',{...options,path:prefix+'/api/pilot-0.3.0',expires:new Date(1),maxAge:0});
  res.redirect=(url)=>redirect(url==='/pilot-0.3.0'?prefix+url:url);
  req.cookies=Object.fromEntries(Object.entries(req.cookies).filter(([key])=>key.startsWith('sim_'+selected+'_')).map(([key,value])=>[key.slice(6),value]));
  // Intentional negative check uses the OTHER fictional tenant's session.
  if(req.path==='/cross-access'){
   req.url='/session/message';req.body={sessionId:states[selected==='A'?'B':'A'].id,
    requestId:'cross-access-fixture',content:'Teste fictício de acesso cruzado.'};
  }
  routers[selected](req,res,next);
 });
 app.use(prefix+'/api',(_req,res)=>res.status(404).json({error:'API fora do escopo da simulação.'}));
 const {createServer}=await import(pathToFileURL(frontend.resolve('vite')).href);
 const react=(await import(pathToFileURL(frontend.resolve('@vitejs/plugin-react')).href)).default;
 const tailwind=(await import(pathToFileURL(frontend.resolve('@tailwindcss/vite')).href)).default;
 const banner=`<aside style="background:#fff2b8;color:#171717;padding:10px;font:14px sans-serif;border-bottom:3px solid #b58a00">
 <strong>SIMULAÇÃO TÉCNICA • technical-step3 • sem IA externa / dados reais</strong>
 <span> — A e B têm organizações e estados separados. Login abaixo é fictício. Respostas têm atraso de 6s; custo exibido é fictício/zero.</span>
 <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">
 <form method="post" action="${prefix}/choose"><button name="identity" value="A">Usar identidade A</button> <button name="identity" value="B">Usar identidade B</button></form>
 <form method="post" action="${prefix}/api/pilot-0.3.0/cross-access"><button>Tentar acesso à outra organização (esperado: 403)</button></form>
 <form method="post" action="${prefix}/stop"><button>Encerrar ambiente descartável</button></form></div></aside>`;
 const vite=await createServer({configFile:false,root:root+'/artifacts/iai-web',base:prefix+'/',
  cacheDir:dir+'/vite-cache',plugins:[react(),tailwind(),{
   name:'isolated-simulation-adapter',enforce:'pre',
   transform(code,id){if(id.startsWith(root+'/artifacts/iai-web/src/')&&/\.[jt]sx?$/.test(id))
    return code.replaceAll('"/api/pilot-0.3.0"',JSON.stringify(prefix+'/api/pilot-0.3.0'))
     .replace('IA real:','Serviço simulado:')
     .replace('"Anthropic direto"','"Determinístico local"')
     .replace('"Anthropic via Replit"','"Determinístico local"')
     .replace('Haiku 4.5 / Sonnet 4.5','sem modelos externos')
     .replaceAll('Entrar com Replit —','Entrar com identidade fictícia —')
     .replace('Somente a conta Replit do proprietário pode abrir esta rodada. Após','Autenticação de teste: não usa conta Replit nem e-mail. Após');},
   transformIndexHtml(html){return html.replace('<body>','<body>'+banner).replace('<title>IAí</title>','<title>IAí — SIMULAÇÃO TÉCNICA</title>');},
  }],resolve:{alias:{'@':root+'/artifacts/iai-web/src','@assets':root+'/attached_assets'},dedupe:['react','react-dom']},
  server:{middlewareMode:true,hmr:false,allowedHosts:true,fs:{strict:true,
   allow:[root+'/artifacts/iai-web',root+'/attached_assets',root+'/node_modules',root+'/lib'],
   deny:['.env','.env.*','**/.git/**','**/generated-artifacts/**','**/*state*.json','**/*.pem']}},
  appType:'spa'});
 app.get(prefix+'/',(_req,res)=>res.redirect(prefix+'/pilot-0.3.0'));
 app.use(vite.middlewares);
 const server=app.listen(Number(process.env.PORT),'0.0.0.0',()=>process.send?.({ready:true,dir}));
 let stopping=false;
 async function shutdown(){
  if(stopping)return;stopping=true;
  server.close();await vite.close();
  // Do not delete an in-flight fixture; stopping never affects original data.
  console.log('SIMULATION_STOPPED; fictional evidence retained at '+dir);
  process.exit(0);
 }
 process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
