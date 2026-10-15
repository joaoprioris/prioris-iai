# Revisable schema — technical-step3

No merge, application startup or build applies schema. `scripts/post-merge.sh`
only installs locked dependencies. `push` / `push-force` remain explicit manual
commands, NOT the recommended migration procedure for an existing database.

`0001-baseline.sql` records the current eight-table Drizzle schema, not new
methodology. It must only initialize a verified empty disposable database.
The legacy private-history SQL is historical material, not automatically applied.
Do not baseline an existing database by running this SQL or dropping its tables.

For a future change: commit numbered SQL with its preconditions, reviewed diff,
transaction/locking implications, verification queries, backup and rollback plan.
Compare against `lib/db/src/schema/`; no automatic application on code update.
For an existing development database, first review the actual schema delta and
authorize that target explicitly. This intervention never connects to it.

Disposable rehearsal (all commands need an explicitly isolated Unix socket,
port/user/database, never inherited app credentials):

    psql -X -v ON_ERROR_STOP=1 -d fictional -f lib/db/migrations/0001-baseline.sql
    pg_dump -Fc -d fictional -f fictional.dump
    pg_restore --exit-on-error -d fictional_restored fictional.dump

Rollback of this EMPTY rehearsal only:

    psql -X -v ON_ERROR_STOP=1 -d fictional -f lib/db/migrations/0001-baseline.down.sql

For valuable data a DROP rollback is NOT acceptable: restore the verified backup
to a separate database, reconcile writes since backup, and authorize cutover.
Replit-managed production schema is separately controlled by the Publish UI;
this directory is not a production migration runner and does not disable that
platform behavior. No publication is part of this revision.
