# Frozen DB Seeds for Migration Tests

Frozen schema-version snapshots used by `LiftMarkTests/DatabaseMigrationTests.swift` to pin the behavior of the legacy hand-rolled migration chain and the GRDB bridge that replaces it.

Each seed represents a DB that stopped at a specific `schema_version`. Tests load a seed into a temp path, run the forward migration chain, and assert the result matches the expected post-v13 shape and data. Seeds are cross-checked against the live migration code by `testVNSeedMatchesLiveMigrateToVN`, so editing a historical migration without updating its seed fails immediately rather than silently pinning the wrong target.

See:

- [`spec/data/migration-contract.md`](../../spec/data/migration-contract.md) — migration rules, lossy-transformation inventory, and the new-migration checklist (which covers how to add a `vN` seed when a v14+ migration lands).
- [`spec/services/migrator.md`](../../spec/services/migrator.md) — bridge semantics, backup contract, and failure matrix.
- [`spec/data/database-schema.md`](../../spec/data/database-schema.md) — v13 post-migration schema and version history.

The actual seed files (`vN.sql`, `vN-data.sql`) land with PR 2 of the GRDB migration series.
