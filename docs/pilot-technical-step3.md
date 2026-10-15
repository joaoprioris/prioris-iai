# IAí — technical-step3 (2026-10-15)

Flow version remains **0.3.4**, methodological-1 / consistency-2 preserved.
This revision concerns local persistence and schema review only. No prompts,
agent decisions, access expiration, campaign balance or suspension were changed.

## Storage guarantees and conservative recovery

`pilot-persistence.cjs` delegates short filesystem operations to
`pilot-durable-io.cjs`, under Linux `flock`. The kernel releases the write guard
when its process exits. A durable, checksummed `.pending` journal precedes atomic
canonical replacement; files and containing directories are explicitly fsynced.
Snapshots are retained. Every read first resolves a valid pending write; an
inconsistent journal/snapshot fails closed without deleting evidence. Constructor
loading also hydrates the caller's state, so journal recovery cannot be overwritten
by state read before recovery.

Whole-state compare-and-swap still rejects stale writers. Conversation, receipts,
committed responses, audit and budget remain in the same canonical state.
Reservation is durable before the simulated/real transport may be called.
Restart without a confirmed result retains the original reservation and marks
the delivery uncertain; no automatic retry or fabricated usage is introduced.

Request ownership uses Linux boot/PID/start identity, not a time-based timeout.
A demonstrably dead owner is archived under `lock-recovery/` while protected by
the kernel guard. A live, malformed, incomplete or unverifiable owner remains
blocked. A legacy `.write-lock` without verifiable ownership is NOT deleted.
Completed ownership records are also archived rather than partially unlinked.
Neither lock recovery nor journal replay releases money or renews access.

**Deployment limit:** this is for processes on ONE Linux host sharing ONE durable
local directory, with working flock/fsync/atomic rename and adequate disk space.
Servers with independent storage cannot share idempotency, receipts or budget
and must NOT run this campaign concurrently. Cross-host/network filesystem
semantics and host ownership are not supported or certified by this revision.
Flushing cannot recover a lost volume, failed hardware, or remote output never
received/persisted. Unknown remote output stays unknown, not automatically retried.
Synchronous short worker processes add latency; no throughput claim is made.

## Schema

Removed automatic `db push` from `scripts/post-merge.sh`; no script was executed.
`lib/db/migrations/0001-baseline.sql` records the existing eight-table schema.
Its down script is destructive and ONLY for an empty disposable rehearsal.
No schema or methodology was redesigned. Future deltas need numbered reviewed SQL,
explicit target authorization, backup/verification/return instructions.
See `lib/db/migrations/README.md`. No production migration runner was added;
Replit's separate Publish schema behavior is not changed.

## Executed verification

Evidence directory: `generated-artifacts/technical-step3/` (ignored by Git/deploy).

- Linux Node tests: **26 distinct tests**: 18 existing and 8 added.
  Initial execution: 24 passed, 2 failed. One was the active-request error mapping
  (503 versus expected 409); one was a fictional receipt missing its content hash.
  Both corrected. Focused repeat: **15/15 passed** (8 new + 7 consistency);
  the other **11/11 reliability tests** had passed in the initial execution.
  No extra repeat of that successful suite.
- Real disposable processes: SIGKILL after journal publication, partial canonical
  temp write, new-process recovery, stale concurrent writers, active request owner,
  killed owner, uncertain delivery/no replay, unknown owner and absent flock.
- PostgreSQL **16.10**, separate temporary cluster, private Unix socket, no TCP:
  **6 checks passed**. Versioned baseline equals independent Drizzle-generated
  schema by normalized pg_dump; actual server restart preserves fictional rows;
  custom-format backup restores schema/data to another disposable database;
  empty baseline rollback succeeds. Cluster stopped and removed afterward.
- API typecheck and isolated build: each executed **once**, passed.
  `IAI_BUILD_DIR` permits checking the build without replacing the running
  preview's dist files. No app workflow was restarted.

Commands actually executed:

    pnpm --filter @workspace/db exec drizzle-kit generate --dialect postgresql --schema ./src/schema/index.ts --out /tmp/iai-step3-schema
    node --test scripts/pilot-durability-step3.test.cjs scripts/pilot-consistency.test.cjs scripts/pilot-reliability.test.cjs
    python3 scripts/pilot-postgres-step3.py
    node --test scripts/pilot-durability-step3.test.cjs scripts/pilot-consistency.test.cjs
    pnpm --filter @workspace/api-server run typecheck
    IAI_BUILD_DIR="$PWD/generated-artifacts/technical-step3/api-build" pnpm --filter @workspace/api-server run build

The Python rehearsal records its six outcomes; it invokes initdb, pg_ctl,
createdb, psql, pg_dump and pg_restore exclusively against its temporary cluster.
The test suites use fictitious inputs/simulated services, never product models.

## Evidence and activation boundary

`node-tests-initial-failures.tap`, `node-tests-fixed.tap`, `postgres.log`,
`postgres-result.json`, `fictional-pg16.dump`, `typecheck-build.log`, `result.json`,
`before.json`, and `original/` contain recoverable evidence.
The original source copies are from the pre-intervention Git HEAD
`9803052a17da07e86063f09bdfb2b1a1649795cd`, not a reconstruction of user data.
The campaign file's before/after SHA is recorded without copying its contents.

No model calls, existing database writes, installation, publication, access
renewal or campaign mutation occurred. The running preview was not reloaded with
this revision: source and isolated build are verified, activation awaits an
explicitly authorized restart. These tests are not semantic or production approval.
