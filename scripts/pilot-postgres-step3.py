"""Isolated PostgreSQL 16 rehearsal. Never uses DATABASE_URL or inherited PG*."""
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
out = root / "generated-artifacts/technical-step3"
out.mkdir(parents=True, exist_ok=True)
work = pathlib.Path(tempfile.mkdtemp(prefix="iai-pg-step3-"))
env = {k: v for k, v in os.environ.items()
       if not k.startswith("PG") and k != "DATABASE_URL"}
env.update(PGHOST=str(work), PGPORT="55439", PGUSER="fictional_owner", PGDATABASE="postgres")
checks = []
started = False


def run(args):
    result = subprocess.run(args, env=env, cwd=root, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed: {result.stderr[:1500]}")
    return result.stdout


def sql(db, query):
    return run(["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-d", db, "-c", query]).strip()


def dump_schema(db):
    text = run(["pg_dump", "--schema-only", "--no-owner", "--no-privileges", "-d", db])
    # pg_dump 16 security nonce differs each invocation; ignore presentation only.
    return re.sub(r"^\\(?:un)?restrict .*$", "", text, flags=re.M)


try:
    run(["initdb", "-D", str(work / "data"), "-A", "trust", "-U", "fictional_owner",
         "--no-locale", "--encoding=UTF8"])
    run(["pg_ctl", "-D", str(work / "data"), "-l", str(work / "server.log"),
         "-o", f"-k {work} -p 55439 -c listen_addresses='' -c unix_socket_permissions=0700",
         "-w", "start"])
    started = True
    version = sql("postgres", "SHOW server_version")
    assert version.startswith("16."), version
    checks.append("PostgreSQL 16 isolated Unix socket, no TCP")
    for name in ["fictional", "from_drizzle", "restored"]:
        run(["createdb", name])
    run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", "fictional",
         "-f", str(root / "lib/db/migrations/0001-baseline.sql")])
    checks.append("versioned baseline applies transactionally to empty database")
    generated = pathlib.Path("/tmp/iai-step3-schema")
    candidates = list(generated.glob("*.sql"))
    if len(candidates) != 1:
        raise RuntimeError("Expected previously generated Drizzle SQL in isolated /tmp directory")
    run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", "from_drizzle", "-f", str(candidates[0])])
    schema = dump_schema("fictional")
    assert schema == dump_schema("from_drizzle"), "Baseline differs from generated Drizzle schema"
    checks.append("baseline equals independent Drizzle-generated schema (pg_dump comparison)")
    sql("fictional", """
      INSERT INTO organizations(id,name) VALUES
        ('00000000-0000-0000-0000-000000000001','Fictional rehearsal');
      INSERT INTO users(id,organization_id,email) VALUES
        ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','fixture@example.invalid');
      INSERT INTO sessions(user_id,organization_id,agent_type,context)
      VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','MNT','{"fictional":true}');
    """)
    backup = out / "fictional-pg16.dump"
    run(["pg_dump", "-Fc", "-d", "fictional", "-f", str(backup)])
    run(["pg_ctl", "-D", str(work / "data"), "-m", "fast", "-w", "restart",
         "-l", str(work / "server.log")])
    assert sql("fictional", "SELECT count(*) FROM sessions") == "1"
    checks.append("real PostgreSQL process restart preserves fictional rows")
    run(["pg_restore", "--exit-on-error", "--no-owner", "-d", "restored", str(backup)])
    assert dump_schema("restored") == schema
    assert sql("restored", "SELECT count(*) FROM sessions WHERE context->>'fictional'='true'") == "1"
    checks.append("custom-format backup restores schema and fictional data to another database")
    run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", "from_drizzle",
         "-f", str(root / "lib/db/migrations/0001-baseline.down.sql")])
    assert sql("from_drizzle", "SELECT count(*) FROM pg_tables WHERE schemaname='public'") == "0"
    checks.append("baseline rollback tested only on empty disposable database")
    result = {"revision": "technical-step3", "postgres": version, "passed": len(checks),
              "checks": checks, "backupSHA256": hashlib.sha256(backup.read_bytes()).hexdigest(),
              "realDatabaseTouched": False}
    (out / "postgres-result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
finally:
    if started:
        run(["pg_ctl", "-D", str(work / "data"), "-m", "fast", "-w", "stop"])
    shutil.rmtree(work)
