import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const {feedbackEvaluationCases}=require('../artifacts/api-server/src/lib/feedback-evaluation-cases.cjs');
const {feedbackReferenceInventory,resolveContract}=require('../artifacts/api-server/src/lib/ex04-reference.cjs');
const {responseInstructions}=require('../artifacts/api-server/src/lib/conversation-instructions.cjs');
const {turnDirective,validateProgress}=require('../artifacts/api-server/src/lib/conversation-guidance.cjs');
const {extractAnthropicContent}=require('../artifacts/api-server/src/lib/anthropic-content.cjs');
const baseContract=require('../artifacts/api-server/src/lib/agent-contract.json');
const responseTool=require('../artifacts/api-server/src/lib/response-tool.json');

const cases=feedbackEvaluationCases();
if(process.argv.includes('--list')){
  console.log(JSON.stringify({inventory:feedbackReferenceInventory(),covered:cases.map(({id,purpose,origin,references,checks,userTurns})=>({id,purpose,origin,references,checks,turns:userTurns.length}))},null,2));
  process.exit(0);
}

const key=process.env.ANTHROPIC_API_KEY;
if(!key)throw Error('ANTHROPIC_API_KEY_REQUIRED');
const model=process.env.ANTHROPIC_MODEL||'claude-sonnet-4-5';
const maxTokens=Number(process.env.ANTHROPIC_MAX_TOKENS||3000);
if(!Number.isInteger(maxTokens)||maxTokens<1200||maxTokens>8192)throw Error('INVALID_ANTHROPIC_MAX_TOKENS');
const effort=process.env.ANTHROPIC_EFFORT;
if(effort&&!['low','medium','high','max'].includes(effort))throw Error('INVALID_ANTHROPIC_EFFORT');

const {default:Anthropic}=await import('@anthropic-ai/sdk');
const client=new Anthropic({apiKey:key,maxRetries:0,timeout:30000});
const profile=resolveContract(baseContract).agents.find(agent=>agent.id==='FBK');
const tool=structuredClone(responseTool);
tool.input_schema.properties.completed.items.properties.criterion.enum=profile.diagnostic_criteria.map(c=>c.id);
tool.input_schema.properties.pending.items.enum=profile.diagnostic_criteria.map(c=>c.id);
tool.input_schema.properties.lenses.items.enum=profile.allowed_transversal_lenses;
for(const variant of tool.input_schema.properties.delivery.anyOf)if(variant.type==='object')variant.properties.kind.enum=['message'];
tool.input_schema.required.push('authorship');

const total={input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0};
function validateScenarioTurn(scenario,index,validated){
  const last=index===scenario.userTurns.length-1;
  const visible=[validated.text,validated.progress?.delivery?.text].filter(Boolean).join('\n');
  if(!last&&validated.progress.stage==='close')throw Error('PREMATURE_CLOSE');
  if(last&&validated.progress.stage!=='close')throw Error('MISSING_EXPLICIT_CLOSE');
  if(/^(?:Leitura(?: do momento)?|Tensão(?: central)?|Direcionamento(?: prático)?):?/imu.test(visible))throw Error('MECHANICAL_HEADINGS');
  if(/\b(?:cronograma|orçamento)\b/iu.test(visible))throw Error('INVENTED_OPERATIONAL_DETAIL');
  if(scenario.id==='fbk-peer-interruption-correction'){
    if(index===1&&!validated.progress.delivery?.text)throw Error('BRIEF_OPENING_MISSING');
    if(/dificult\w*[^.!?]*(?:concluir|raciocínio)/iu.test(visible))throw Error('INVENTED_OR_DEFENDED_IMPACT');
  }
  if(scenario.id==='fbk-peer-deliveries-causality'){
    if(index===1&&!validated.progress.delivery?.text)throw Error('BRIEF_OPENING_MISSING');
    if(index>=2&&/(?:mudança|formato)[^.!?]*(?:causou|provocou|gerou)[^.!?]*atraso/iu.test(visible))throw Error('CORRECTED_CAUSALITY_REASSERTED');
  }
  if(scenario.id==='fbk-negative-example-request'&&index===1&&validated.progress.delivery)throw Error('UNREQUESTED_EXAMPLE');
}
let rejected=0;
for(const scenario of cases){
  const messages=[];
  for(let index=0;index<scenario.userTurns.length;index++){
    messages.push({role:'user',content:scenario.userTurns[index]});
    let reply;
    try{
      reply=await client.messages.create({
        model,max_tokens:maxTokens,
        ...(effort?{output_config:{effort}}:{}),
        system:profile.prompt+'\n'+turnDirective({number:index+1,max:10})+responseInstructions('FBK')+
          '\nMETADADOS DO CENÁRIO DE AVALIAÇÃO, NÃO FATOS DO LÍDER: '+JSON.stringify({origin:scenario.origin,references:scenario.references}),
        tools:[tool],tool_choice:{type:'tool',name:tool.name},messages,
      });
    }catch(error){
      console.error(JSON.stringify({scenario:scenario.id,turn:index+1,status:'provider_uncertain_no_retry',error:error instanceof Error?error.message:String(error)}));
      process.exit(2);
    }
    for(const key of Object.keys(total))total[key]+=Number(reply.usage?.[key]||0);
    const observation={scenario:scenario.id,turn:index+1,model,usage:reply.usage,status:'rejected'};
    try{
      if(reply.stop_reason==='max_tokens')throw Error('INCOMPLETE_RESPONSE');
      const parsed=extractAnthropicContent(reply,{mode:'tool',toolName:tool.name});
      const validated=validateProgress(parsed.input,profile,messages,{number:index+1,max:10});
      validateScenarioTurn(scenario,index,validated);
      messages.push({role:'assistant',content:validated.text});
      console.log(JSON.stringify({...observation,status:'accepted',stage:validated.progress.stage,privateBlocksDiscarded:parsed.privateBlocksDiscarded}));
    }catch(error){
      rejected++;
      console.log(JSON.stringify({...observation,error:error instanceof Error?error.message:String(error)}));
      break;
    }
  }
}
console.log(JSON.stringify({summary:{model,cases:cases.length,rejected,usage:total,retries:0}}));
process.exitCode=rejected?1:0;
