'use strict';
// Run from Replit workspace root. Keeps public deployment and feature flag unchanged.
const fs=require('node:fs'),path=require('node:path');const source=__dirname;
const backup='prioris-review-backup-20261012-routing';fs.mkdirSync(backup,{recursive:true});
function patch(file,transform){const previous=fs.readFileSync(file,'utf8');const next=transform(previous);if(next===previous)return;const saved=path.join(backup,file);fs.mkdirSync(path.dirname(saved),{recursive:true});if(!fs.existsSync(saved))fs.writeFileSync(saved,previous);fs.writeFileSync(file,next);}
const lib='artifacts/api-server/src/lib';
for(const n of ['functional-policy.cjs','conversation-service.cjs','conversation-service.d.cts','private-history-repository.cjs','private-history-repository.d.cts'])fs.copyFileSync(path.join(source,n),path.join(lib,n));
fs.copyFileSync(path.join(source,'agent_contract.json'),path.join(lib,'agent-contract.json'));
fs.copyFileSync(path.join(source,'classification-tool.json'),path.join(lib,'classification-tool.json'));
fs.copyFileSync(path.join(source,'functional-orchestrator.ts'),'artifacts/api-server/src/routes/functional-orchestrator.ts');
fs.copyFileSync(path.join(source,'HistorySettings.tsx'),'artifacts/iai-web/src/components/HistorySettings.tsx');
patch('artifacts/api-server/src/routes/index.ts',s=>{if(s.includes('functionalOrchestratorRouter'))return s;if(!s.includes('router.use(orchestratorRouter)'))throw Error('ROUTER_MARKER_CHANGED');return s.replace('router.use(orchestratorRouter)',"router.use(functionalOrchestratorRouter);\nrouter.use(orchestratorRouter)").replace('import orchestratorRouter',"import functionalOrchestratorRouter from './functional-orchestrator';\nimport orchestratorRouter")});
patch('artifacts/iai-web/src/pages/Chat.tsx',s=>{
 if(s.includes('pendingRequestRef'))return s.includes('data.code === "REQUEST_ALREADY_COMPLETED"')?s:s.replace('setError(data.error ?? "Erro ao enviar mensagem.");','setError(data.error ?? "Erro ao enviar mensagem.");\n        if (data.code === "REQUEST_ALREADY_COMPLETED" || data.code === "SESSION_CLOSED") setSessionClosed(true);');
 const markers=['import IaiIcon','const bottomRef','const text = input.trim();','JSON.stringify({ sessionId, content: text })','const handleNewSession = async () => {','</header>'];
 for(const marker of markers)if(!s.includes(marker))throw Error('CHAT_MARKER_CHANGED');
 s=s.replace('import IaiIcon',"import HistorySettings from '../components/HistorySettings';\nimport IaiIcon");
 s=s.replace('  const bottomRef',"  const pendingRequestRef = useRef<{id:string;sessionId:string;content:string}|null>(null);\n  const bottomRef");
 s=s.replace('const handleNewSession = async () => {','const handleNewSession = async () => {\n    pendingRequestRef.current = null;\n    setSessionId(null);');
 s=s.replace('    setInput("");\n    setSending(true);',"    const previousRequest = pendingRequestRef.current;\n    const requestId = previousRequest?.sessionId === sessionId && previousRequest.content === text ? previousRequest.id : crypto.randomUUID();\n    pendingRequestRef.current = {id:requestId,sessionId,content:text};\n    setInput(\"\");\n    setSending(true);");
 s=s.replace('JSON.stringify({ sessionId, content: text })','JSON.stringify({ sessionId, content: text, requestId })');
 s=s.replace('setError(data.error ?? "Erro ao enviar mensagem.");','setError(data.error ?? "Erro ao enviar mensagem.");\n        if (data.code === "REQUEST_ALREADY_COMPLETED" || data.code === "SESSION_CLOSED") setSessionClosed(true);');
 // Failed attempts restore the original input and remove both optimistic messages.
 s=s.replaceAll('setMessages((prev) => prev.slice(0, -1));','setMessages((prev) => prev.slice(0, -2));\n        setInput(text);');
 s=s.replace('setExchangeCount(event.exchangeCount);','pendingRequestRef.current = null;\n              setExchangeCount(event.exchangeCount);');
 // Detect an interrupted stream, including failures after the server committed.
 s=s.replace('      let buffer = "";','      let buffer = "";\n      let completed = false;');
 s=s.replace('pendingRequestRef.current = null;\n              setExchangeCount','completed = true;\n              pendingRequestRef.current = null;\n              setExchangeCount');
 s=s.replace('    } catch {\n      setError("Erro de conexão.");','      if (!completed) throw new Error("INCOMPLETE_STREAM");\n    } catch {\n      setError("A resposta não chegou por completo. Tente enviar a mesma mensagem novamente.");');
 s=s.replace('</header>','</header>\n      <HistorySettings busy={sending} onErased={() => { void handleNewSession(); }} />');
 return s;
});
console.log('DEVELOPMENT_INTEGRATED_FLAG_OFF_NO_DATABASE_MIGRATION');
