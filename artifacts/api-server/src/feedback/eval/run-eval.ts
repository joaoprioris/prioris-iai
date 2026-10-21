import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicProvider } from "../anthropic-provider.ts";
import { runTurn, type ChatMessage, type FeedbackProvider } from "../conversation.ts";
import { BudgetExceeded, BudgetGuard, DEFAULT_CAP_USD, guardClient } from "./budget.ts";
import { accept, deterministicChecks, judgeConversation, type Acceptance, type Verdict } from "./judge.ts";
import { SCENARIOS, type Scenario } from "./scenarios.ts";
import { nextLeaderMessage, rateConversation, type LeaderRating } from "./simulated-leader.ts";

export interface Deps {
  agent: FeedbackProvider;
  nextLeader: (scenario: Scenario, history: ChatMessage[]) => Promise<string>;
  rate: (scenario: Scenario, history: ChatMessage[]) => Promise<LeaderRating>;
  judge: (scenario: Scenario, history: ChatMessage[]) => Promise<Verdict>;
}

export interface ConversationResult {
  simulated: true;
  scenarioId: string;
  estado: string;
  exchanges: number;
  endedBy: "agent_closed" | "closed_by_limit" | "provider_error" | "invalid";
  history: ChatMessage[];
  rating?: LeaderRating;
  verdict?: Verdict;
  checks?: string[];
  acceptance?: Acceptance;
  error?: string;
}

/** O líder simulado responde sozinho a cada fala do agente; ninguém conduz a conversa por fora. */
export async function runConversation(deps: Deps, scenario: Scenario): Promise<ConversationResult> {
  let history: ChatMessage[] = [];
  let message = scenario.opening;
  let endedBy: ConversationResult["endedBy"] = "agent_closed";

  for (;;) {
    const turn = await runTurn(deps.agent, history, message);
    if (turn.status === "error") {
      endedBy = "provider_error";
      break;
    }
    if (turn.status !== "ok") {
      endedBy = "invalid";
      break;
    }
    history = turn.history;
    if (turn.closed) break;
    message = await deps.nextLeader(scenario, history);
  }

  const exchanges = history.filter((m) => m.role === "user").length;
  const base = { simulated: true as const, scenarioId: scenario.id, estado: scenario.estado, exchanges, history };
  if (endedBy === "provider_error" || endedBy === "invalid") {
    return { ...base, endedBy, error: "conversa interrompida antes do encerramento" };
  }

  const [rating, verdict] = await Promise.all([deps.rate(scenario, history), deps.judge(scenario, history)]);
  const checks = deterministicChecks(history);
  return { ...base, endedBy, rating, verdict, checks, acceptance: accept(rating, verdict, checks) };
}

/** runTurn engole a causa do erro do provider; aqui ela fica registrada para diagnóstico da rodada. */
function loggingProvider(provider: FeedbackProvider): FeedbackProvider {
  return {
    async complete(input) {
      try {
        return await provider.complete(input);
      } catch (error) {
        console.log(`  falha do agente: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    },
  };
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`variável de ambiente ${name} não definida`);
  return value;
}

async function main(): Promise<void> {
  const outDir = option("out");
  if (!outDir) throw new Error("use --out <pasta fora do repositório>");
  const cap = Number(option("cap") ?? DEFAULT_CAP_USD);
  const spentBefore = Number(option("spent-before") ?? 0);
  const only = option("only")?.split(",");
  const scenarios = SCENARIOS.filter((scenario) => !only || only.includes(scenario.id));

  const models = {
    agent: requireEnv("PRIORIS_FEEDBACK_MODEL"),
    leader: process.env.PRIORIS_EVAL_LEADER_MODEL ?? "claude-haiku-5-5",
    judge: process.env.PRIORIS_EVAL_JUDGE_MODEL ?? "claude-haiku-5-5",
    finalJudge: process.env.PRIORIS_EVAL_FINAL_JUDGE_MODEL,
  };
  const guard = new BudgetGuard(cap, spentBefore);
  // PRIORIS_API_KEY evita o nome reservado ANTHROPIC_API_KEY, que o ambiente do Claude Code não usa para autenticar.
  const apiKey = process.env.PRIORIS_API_KEY ?? requireEnv("ANTHROPIC_API_KEY");
  const client = guardClient(new Anthropic({ apiKey }), guard);
  const deps: Deps = {
    agent: loggingProvider(createAnthropicProvider({ model: models.agent, client })),
    nextLeader: (scenario, history) => nextLeaderMessage(client, models.leader, scenario, history),
    rate: (scenario, history) => rateConversation(client, models.leader, scenario, history),
    judge: (scenario, history) => judgeConversation(client, models.judge, scenario.foco, history),
  };

  fs.mkdirSync(outDir, { recursive: true });
  const results: ConversationResult[] = [];
  const startSpent = guard.spentUsd;
  for (const scenario of scenarios) {
    try {
      const result = await runConversation(deps, scenario);
      if (result.acceptance?.accepted && models.finalJudge) {
        const second = await judgeConversation(client, models.finalJudge, scenario.foco, result.history);
        result.acceptance = accept(result.rating!, second, result.checks ?? []);
        result.verdict = second;
      }
      results.push(result);
      fs.writeFileSync(path.join(outDir, `${scenario.id}.json`), JSON.stringify(result, null, 2));
      const status = result.acceptance ? (result.acceptance.accepted ? "ok" : "reprovada") : "interrompida";
      console.log(`${scenario.id}: ${status} (${result.exchanges} trocas) total gasto US$ ${guard.spentUsd.toFixed(4)}`);
    } catch (error) {
      console.log(`${scenario.id}: erro ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof BudgetExceeded) break;
    }
  }

  const accepted = results.filter((result) => result.acceptance?.accepted).length;
  const summary = {
    simulated: true,
    models,
    capUsd: cap,
    spentThisRunUsd: guard.spentUsd - startSpent,
    spentTotalUsd: guard.spentUsd,
    calls: guard.calls,
    run: results.length,
    accepted,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
