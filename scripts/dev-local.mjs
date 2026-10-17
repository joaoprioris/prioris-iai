import { spawn } from "node:child_process";

const missing = ["DATABASE_URL"].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  process.exit(1);
}

const apiPort = process.env.IAI_API_PORT ?? "8080";
const webPort = process.env.IAI_WEB_PORT ?? "5173";
const shared = {
  ...process.env,
  NODE_ENV: "development",
  PRIORIS_AI_PROVIDER: "anthropic",
  IAI_LOCAL_HTTP: "true",
  APP_BASE_URL: process.env.APP_BASE_URL ?? `http://localhost:${webPort}`,
};

const children = [
  spawn("pnpm", ["--filter", "@workspace/api-server", "run", "dev"], {
    stdio: "inherit",
    env: { ...shared, PORT: apiPort },
  }),
  spawn("pnpm", ["--filter", "@workspace/iai-web", "run", "dev"], {
    stdio: "inherit",
    env: { ...shared, PORT: webPort, BASE_PATH: "/", IAI_API_ORIGIN: `http://127.0.0.1:${apiPort}` },
  }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`Processo local encerrou (${signal ?? code}).`);
      stop();
      process.exitCode = code ?? 1;
    }
  });
}
