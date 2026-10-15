#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Schema changes require explicit review/application; never mutate a DB on merge.
echo "Schema was not applied. See lib/db/migrations/README.md."
