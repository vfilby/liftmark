# Migration Contract

> Behavioral contract for LiftMark schema migrations. Owned by [`../services/migrator.md`](../services/migrator.md); this doc pins the rules every migration implementation must satisfy, and enumerates the lossy transformations that have already shipped.
>
> See also: [`database-schema.md`](database-schema.md) for the v13 post-migration schema, [`import-export-schema.md`](import-export-schema.md) for how migrations interact with imports.

---

## Core rules

### 1. Pure function of pre-state

Every migration is a **pure function** of the pre-migration database state. Given the same input DB, a migration must produce the same output DB on every run. Migrations must not:

- Read the wall clock for anything other than an explicit `updated_at` backfill (and that backfill must be specified against a deterministic rule — never `NOW()` as a stand-alone value for application-visible data).
- Read external state (network, file system outside the DB, `UserDefaults`, environment variables).
- Depend on the device, user identity, or build configuration.

### 2. Idempotency under bridge re-invocation

The migration chain may be invoked more than once on the same database by the bridge (see [`../services/migrator.md`](../services/migrator.md)). A migration that has already been applied — as recorded in `grdb_migrations` — **must not** be re-executed. A migration's body does not need to be internally idempotent; the `grdb_migrations` identifier row is the canonical "already done" signal.

### 3. Atomicity

Every migration executes inside a single transaction opened by `DatabaseMigrator`. A failure anywhere in the body rolls back the entire migration and leaves the DB in the pre-migration state. The bridge write that precedes the first post-bridge migration executes inside the **same** transaction, so partial bridge state is never observable.

### 4. Identifier stability

The identifier used to register a migration with `DatabaseMigrator` is a wire-level contract. Once a migration has shipped to any user, its identifier **must not change**. Renames, reorderings, or deletions of applied migration identifiers are forbidden. See [`../services/migrator.md`](../services/migrator.md) §1.1 for the canonical identifier list.

### 5. Forward-only

Migrations are forward-only. There is no `down` migration. Rollback is achieved by restoring the pre-upgrade backup file (see [`../services/backup.md`](../services/backup.md) → "Pre-upgrade backup") or, where the migration has already committed and backup restore is the only option, via the recovery path in [`../services/migrator.md`](../services/migrator.md) §3.

---

## Bridge contract

The bridge is the one-time adapter that translates the legacy `schema_version` single-row state into GRDB's `grdb_migrations` identifier rows.

**Contract:**

> If a DB carries a legacy `schema_version` row with value N (where 1 ≤ N ≤ 13), the bridge completes any pending legacy migrations through v13 using the in-process legacy chain, then inserts identifier rows `v1_bootstrap`..`vN_*` (for the final N after legacy catch-up) into `grdb_migrations`, then hands off control to `DatabaseMigrator.migrate(db)`.

**Invariants:**

- **Refuses to mutate** if `grdb_migrations` is already populated AND `schema_version.version > 13`. This detects an unsupported downgrade-then-upgrade sequence where a future build wrote `schema_version.version > 13` before being rolled back to the bridge build.
- **Does not drop `schema_version`.** The table and its row persist after bridging so that a user who downgrades to a pre-bridge build still observes `version = 13` and the old migrator no-ops. Removal is telemetry-gated and happens in a later cleanup migration — see [`../services/migrator.md`](../services/migrator.md) §6.
- **Never modifies user data.** The bridge writes only to `grdb_migrations` (and, for fresh installs, a single `schema_version.version = 13` row for downgrade safety).
- **Preceded by a restorable backup.** The bridge never runs without a verified backup at `<Application Support>/LiftMark/pre-grdb-bridge.bak.db`. See [`../services/backup.md`](../services/backup.md).

Full bridge semantics, failure matrix, and rollout model: [`../services/migrator.md`](../services/migrator.md).

---

## Lossy-transformation inventory

Migrations that have already shipped contain silent data-drops. These are pinned here so that (a) the bridge preserves their current effect bit-for-bit rather than accidentally "fixing" them, and (b) future migrations that claim to remediate them do so explicitly.

Upgrade-path tests in `LiftMarkTests/DatabaseMigrationTests.swift` assert each of these holds end-to-end.

### SR1 — v12 parent indexes not re-created

Migration v11 created three self-FK parent indexes:

- `idx_session_exercises_parent` on `session_exercises(parent_exercise_id)`
- `idx_session_sets_parent` on `session_sets(parent_set_id)`
- `idx_template_exercises_parent` on `template_exercises(parent_exercise_id)`

Migration v12 rebuilt `session_sets` and `template_sets` via `CREATE TABLE … INSERT SELECT … DROP TABLE … RENAME`. This implicitly dropped the indexes on the rebuilt tables, and v12 re-creates **only** `idx_session_sets_exercise` and `idx_template_sets_exercise`. The parent indexes are **not re-created**.

For `session_sets` specifically, the `parent_set_id` column itself is removed (see SR2), so the index is obsolete. For `template_exercises` (not rebuilt in v12) and `session_exercises` (not rebuilt in v12), the parent indexes remain.

### SR2 — v12 silently drops dropset columns on `session_sets`

Migration v12 rebuilds `session_sets` and does **not** carry forward these columns:

- `parent_set_id` (dropset chain parent)
- `drop_sequence` (dropset ordering index)
- `tempo` (tempo annotation)

Any rows that used these columns lose the data. There is no fan-out into `set_measurements` for these — the relationship is gone.

### SR3 — v12 forces `is_amrap = 0` on all pre-v12 `session_sets`

`session_sets` did not have an `is_amrap` column before v12. The rebuild includes `SELECT 0 AS is_amrap` in the `INSERT … SELECT` clause, so every pre-existing row gets `is_amrap = 0` regardless of any prior semantic intent.

### SR4 — v9 drops `sync_queue` and `sync_conflicts`

Migration v9 unconditionally `DROP TABLE IF EXISTS sync_queue; DROP TABLE IF EXISTS sync_conflicts`. Any queued or unresolved rows are lost. In practice this is zero-impact because CKSyncEngine replaced the queue before v9 shipped, but the drop is **observable** by any DB snapshotted before v9.

### v12 template_sets legacy drops

Migration v12 also drops `tempo` and `target_weight_unit` from `template_sets`. Listed here for completeness; covered under the general "legacy columns removed in v12" note in [`database-schema.md`](database-schema.md).

---

## New-migration checklist

When adding a v14 (or later) migration:

1. **Spec first** — update [`database-schema.md`](database-schema.md) with the new shape and add a row to its Version History table.
2. **Register** the migration with `DatabaseMigrator` under a stable identifier `vN_<short_description>`. Add the identifier to [`../services/migrator.md`](../services/migrator.md) §1.1.
3. **Add a test seed** under `test-fixtures/db-seeds/vN.sql` + `vN-data.sql` and a cross-check test `testVNSeedMatchesLiveMigrateToVN`. See [`../../test-fixtures/db-seeds/README.md`](../../test-fixtures/db-seeds/README.md).
4. **Enumerate lossy transformations** (if any) under an `SR5…` entry in this document. If the migration is genuinely lossless, state that explicitly in the PR description.
5. **Verify idempotency** — the migration must be safely skippable when its identifier is already in `grdb_migrations`. This is inherent to `DatabaseMigrator` but worth re-verifying with a post-vN seed in tests.
