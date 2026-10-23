import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, chownSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sql = (name: string) => readFileSync(join(here, "..", "sql", name), "utf8");

export const hasServer = (): boolean => findBin() !== null;

function findBin(): string | null {
  const base = "/usr/lib/postgresql";
  if (!existsSync(base)) return null;
  const versions = readdirSync(base).sort((a, b) => Number(b) - Number(a));
  for (const version of versions) {
    const bin = join(base, version, "bin");
    if (existsSync(join(bin, "initdb"))) return bin;
  }
  return null;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export interface TestDatabase {
  port: number;
  database: string;
  client(role: string): Promise<pg.Client>;
  stop(): void;
}

/** Cluster PostgreSQL temporário com dados fictícios. Devolve null se não houver binários do servidor. */
export async function startDatabase(): Promise<TestDatabase | null> {
  const bin = findBin();
  if (!bin) return null;
  const isRoot = process.getuid?.() === 0;
  const run = (command: string, args: string[]) =>
    isRoot
      ? execFileSync("runuser", ["-u", "postgres", "--", join(bin, command), ...args], { stdio: "pipe" })
      : execFileSync(join(bin, command), args, { stdio: "pipe" });
  const dir = mkdtempSync(join(tmpdir(), "prioris-review-"));
  if (isRoot) chownSync(dir, Number(execFileSync("id", ["-u", "postgres"]).toString()), Number(execFileSync("id", ["-g", "postgres"]).toString()));
  const data = join(dir, "data");
  const port = await freePort();
  run("initdb", ["-D", data, "-A", "trust", "-U", "postgres", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${dir}`, "-l", join(dir, "log"), "-w", "start"]);

  const database = "review_test";
  const connect = async (user: string, db: string) => {
    const client = new pg.Client({ host: "127.0.0.1", port, user, database: db });
    await client.connect();
    return client;
  };
  const admin = await connect("postgres", "postgres");
  await admin.query(`CREATE DATABASE ${database}`);
  await admin.end();
  const owner = await connect("postgres", database);
  await owner.query(sql("roles.sql"));
  await owner.query(`GRANT CREATE ON DATABASE ${database} TO review_owner`);
  await owner.query("SET ROLE review_owner");
  await owner.query(sql("schema.sql"));
  await owner.query("RESET ROLE");
  await owner.query(sql("grants.sql"));
  await owner.end();

  return {
    port,
    database,
    client: (role: string) => connect(role, database),
    stop() {
      try {
        run("pg_ctl", ["-D", data, "-m", "immediate", "stop"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
