import { Router, type Request, type Response, type RequestHandler } from 'express';
import * as oidc from 'openid-client';
import Anthropic from '@anthropic-ai/sdk';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createPilotBudget } from '../lib/pilot-budget.cjs';
import { createPilotStore } from '../lib/pilot-store.cjs';
import {prepareSecondRound,SECOND_IDENTITY} from '../lib/pilot-rounds.cjs';
import {ROUTING_VERSION} from '../lib/functional-policy.cjs';
import { createFunctionalRouter, createModelProviders } from './functional-orchestrator';
import type { AuthenticatedRequest } from '../middlewares/auth';

const BASE='/api/pilot-0.3.0', COOKIE='__Secure-iai-pilot-owner', FLOW='__Secure-iai-pilot-flow';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function createPilotRouter(options:{oidcClient?:typeof oidc;stateFile?:string;client?:Anthropic}={}) {
 const router=Router();
 // No production route, storage, identity, or provider is initialized there.
 const domain=process.env.REPLIT_DEV_DOMAIN;
 if(process.env.NODE_ENV!=='development'||!domain)return router;
 const origin='https://'+domain;
 const provider=process.env.PRIORIS_AI_PROVIDER??'replit';
 const configured=['replit','anthropic'].includes(provider)&&(provider==='replit'
  ?Boolean(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY&&process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL)
  :Boolean(process.env.ANTHROPIC_API_KEY));
 const ownerId=process.env.REPL_OWNER_ID;
 const authConfigured=Boolean(ownerId&&process.env.REPL_ID);
 // Stable across restarts: neither budget nor the single conversation resets.
 const file=options.stateFile??resolve(process.cwd(),process.cwd().endsWith('api-server')?'../../generated-artifacts/pilot-0.3.0-round/state.json':'generated-artifacts/pilot-0.3.0-round/state.json');
 let state:any;
 try{state=JSON.parse(readFileSync(file,'utf8'));if(state.provider!==provider)throw Error('PILOT_STATE_MISMATCH');state=prepareSecondRound(state);}
 catch(err:any){
  // Only injected test fixtures may initialize a new empty ledger. Losing the
  // real pilot file must never silently reset the accumulated expenditure.
  if(err.code!=='ENOENT'||!options.stateFile)return blockedRouter(router);
  state={version:ROUTING_VERSION,round:2,provider,createdAt:Date.now(),expiresAt:Date.now()+2*60*60*1000,budget:{currentRound:2},requests:{},audit:[],archivedRounds:[]};
 }
 const save=()=>{mkdirSync(dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp';writeFileSync(temp,JSON.stringify(state),{mode:0o600});renameSync(temp,file);};
 save();
 const budget=createPilotBudget(state.budget,save);
 const identity=SECOND_IDENTITY;
 const store=createPilotStore(state,save,identity);
 const scope={userId:identity.id,organizationId:identity.organizationId};
 const pending=new Map<string,{verifier:string;nonce:string;state:string;expires:number}>();
 const auth=options.oidcClient??oidc;
 let ownerSession:{digest:string;expires:number}|null=null;
 let config:oidc.Configuration|null=null;
 let sdk:Anthropic|null=null;
 const active=()=>Date.now()<state.expiresAt;
 const cookieOptions={httpOnly:true,secure:true,sameSite:'none' as const,path:BASE,maxAge:2*60*60*1000};
 const authenticated=(req:Request)=>active()&&ownerSession!==null&&ownerSession.expires>Date.now()&&typeof req.cookies?.[COOKIE]==='string'&&hash(req.cookies[COOKIE])===ownerSession.digest;
 const sameOrigin:RequestHandler=(req,res,next)=>{if(req.get('origin')!==origin){res.status(403).json({error:'Origem não autorizada para o piloto.'});return;}next();};
 const authorize:RequestHandler=(req,res,next)=>{
  if(!authenticated(req)){res.status(401).json({error:'Entre com a conta Replit do proprietário para acessar o piloto.'});return;}
  (req as AuthenticatedRequest).user=identity;next();
 };
 const availability=()=>!active()?'Esta rodada expirou. Chamadas reais bloqueadas.':!authConfigured?'Identidade do proprietário não disponível. Chamadas reais bloqueadas.':!configured?'Provedor existente não configurado. Chamadas reais bloqueadas.':budget.snapshot().blocked?(budget.snapshot().reason??'Medição de consumo indisponível. Chamadas bloqueadas.'):null;
 router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 router.get('/status',(req,res)=>res.json({version:ROUTING_VERSION,round:2,authenticated:authenticated(req),available:availability()===null,error:availability(),provider,models:['claude-haiku-4-5','claude-sonnet-4-5'],budget:budget.snapshot(),identity:authenticated(req)?identity:undefined,historyEnabled:false,singleConversation:true}));
 router.post('/login',sameOrigin,async(req,res)=>{
  if(!active()||!authConfigured){res.status(503).send('O piloto está bloqueado: identidade do proprietário ou prazo indisponível.');return;}
  if(authenticated(req)){res.redirect('/pilot-0.3.0');return;}
  if(ownerSession&&ownerSession.expires>Date.now()){res.status(409).send('O piloto já está vinculado a outra sessão do proprietário.');return;}
  if(pending.size>=10)pending.clear();
  try{
   config??=await auth.discovery(new URL('https://replit.com/oidc'),process.env.REPL_ID!);
   const key=randomBytes(32).toString('hex'),verifier=auth.randomPKCECodeVerifier(),nonce=auth.randomNonce(),oauthState=auth.randomState();
   pending.set(hash(key),{verifier,nonce,state:oauthState,expires:Date.now()+5*60*1000});
   const url=auth.buildAuthorizationUrl(config,{redirect_uri:origin+BASE+'/callback',scope:'openid',code_challenge:await auth.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',state:oauthState,nonce});
   res.cookie(FLOW,key,{...cookieOptions,sameSite:'lax',maxAge:5*60*1000});res.redirect(url.href);
  }catch{res.status(503).send('Não foi possível iniciar a autenticação Replit. Nenhuma chamada de IA foi feita.');}
 });
 router.get('/callback',async(req,res)=>{
  const key=req.cookies?.[FLOW],entry=typeof key==='string'?pending.get(hash(key)):undefined;
  if(typeof key==='string')pending.delete(hash(key));
  res.clearCookie(FLOW,cookieOptions);
  try{
   if(!active()||!entry||entry.expires<Date.now()||!config)throw Error('AUTH_DENIED');
   const tokens=await auth.authorizationCodeGrant(config,new URL(req.originalUrl,origin),{pkceCodeVerifier:entry.verifier,expectedState:entry.state,expectedNonce:entry.nonce,idTokenExpected:true});
   const claims=tokens.claims();
   if(!claims||claims.sub!==ownerId||ownerSession&&ownerSession.expires>Date.now())throw Error('AUTH_DENIED');
   const sid=randomBytes(32).toString('hex');
   ownerSession={digest:hash(sid),expires:Math.min(state.expiresAt,Date.now()+2*60*60*1000)};
   res.cookie(COOKIE,sid,cookieOptions);res.redirect('/pilot-0.3.0');
  }catch{res.status(403).send('Acesso negado. Use a conta Replit do proprietário; se a autorização expirou, volte ao piloto.');}
 });
 router.post('/logout',sameOrigin,authorize,(_req,res)=>{ownerSession=null;res.clearCookie(COOKIE,cookieOptions);res.json({ok:true});});
 router.post('/sessions',sameOrigin,authorize,(_req,res)=>res.json(store.open(scope)));
 // A lazy, budgeted SDK: startup, login and session creation do not call AI.
 const guardedClient={messages:{create:async(payload:any)=>{
  if(!availability()&&!budget.snapshot().blocked){
   return budget.call(payload,async p=>{
    if(options.client)return options.client.messages.create(p);
    if(!sdk){
     const apiKey=provider==='replit'?process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!:process.env.ANTHROPIC_API_KEY!;
     const baseURL=provider==='replit'?process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL:undefined;
     sdk=new Anthropic({apiKey,...(baseURL?{baseURL}:{}),maxRetries:0,timeout:30000});
    }
    return sdk.messages.create(p);
   });
  }
  throw Error('PILOT_UNAVAILABLE');
 }}};
 const model=createModelProviders({client:guardedClient as unknown as Anthropic});
 router.post('/session/message',sameOrigin,authorize,(req,res,next)=>{
  const unavailable=availability();
  if(unavailable||budget.snapshot().blocked){res.status(503).json({error:unavailable??'Medição de consumo indisponível. Chamadas bloqueadas.'});return;}
  if(!state.session||req.body.sessionId!==state.session.id){res.status(403).json({error:'Somente a conversa fictícia desta rodada é permitida.'});return;}
  next();
 });
 router.use(createFunctionalRouter({repository:store.repository,authorize,origins:()=>[origin],enabled:()=>true,...model}));
 return router;
}
function blockedRouter(router:ReturnType<typeof Router>){
 router.use((_req,res)=>res.status(503).json({error:'Estado isolado do piloto indisponível. Chamadas reais bloqueadas.',available:false,authenticated:false,version:ROUTING_VERSION}));return router;
}
export default createPilotRouter();
