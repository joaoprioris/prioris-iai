'use strict';
// Observe exact source inputs; do not convert old labels into validated truth.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const Anthropic=require(path.resolve('artifacts/api-server/node_modules/@anthropic-ai/sdk')).default;
const {decideRoute}=require('./functional-policy.cjs'),{readAnalysis}=require('./conversation-service.cjs');
const tool=require('./classification-tool.json'),cases=require('./evaluation_cases.json');
const source=fs.readFileSync(path.join(__dirname,'functional-orchestrator.ts'),'utf8');const system=source.match(/const CLASSIFICATION_PROMPT = `([\s\S]*?)`;/)[1];
const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,maxRetries:0,timeout:30000});
const report={synthetic:true,purpose:'Routing observation, not approval of response quality',budgetCapUSD:1,estimatedUSD:0,observations:[],pending:[]};
function save(){fs.writeFileSync(path.join(__dirname,'model-matrix-result.json'),JSON.stringify(report,null,2));}
(async()=>{for(const c of cases){if(c.type==='Transição'){report.pending.push({id:c.id,reason:'Requires a sequence and verified history fixtures; single-message call would not validate transition.'});continue}if(report.estimatedUSD+0.03>report.budgetCapUSD)throw Error('BUDGET_GUARD');
 const observation={id:c.id,type:c.type,inputHash:createHash('sha256').update(c.input).digest('hex'),input:c.input,sourceExpected:c.source_expected,proposed:c.initial_proposal,fixtureRequirements:c.fixture_requirements,status:'Observed; semantic review pending'};
 try{const r=await client.messages.create({model:'claude-haiku-4-5',max_tokens:600,system,tools:[tool],tool_choice:{type:'tool',name:tool.name},messages:[{role:'user',content:JSON.stringify({conversation:[{role:'user',content:c.input}],privateHistory:'[]',previousAgent:null})}]});observation.model=r.model;observation.usage=r.usage;const u=r.usage;observation.costUSD=(u.input_tokens+u.output_tokens*5+(u.cache_creation_input_tokens||0)*1.25+(u.cache_read_input_tokens||0)*0.1)/1e6;report.estimatedUSD+=observation.costUSD;const block=r.content.find(b=>b.type==='tool_use'&&b.name===tool.name);if(r.stop_reason==='max_tokens'||!block)throw Error('INCOMPLETE_CLASSIFICATION');observation.analysis=readAnalysis(block.input);observation.route=decideRoute(observation.analysis);}
 catch(e){observation.status='Failed call or validation';observation.errorType=e.name;observation.httpStatus=e.status??null}
 report.observations.push(observation);save();}
 save();console.log(JSON.stringify({observed:report.observations.length,pending:report.pending.length,failures:report.observations.filter(x=>!x.route).length,estimatedUSD:report.estimatedUSD}));})().catch(e=>{save();console.log(JSON.stringify({errorType:e.name,budgetGuard:e.message==='BUDGET_GUARD'}));process.exitCode=1});
