# Cradle Persistence Layer

## Current implementation

The API runtime uses `SqliteOperationStore` as its default operation store. Set
`CRADLE_SQLITE_FILE` to choose another database path; otherwise the database is
created at `.runtime/cradle.sqlite` under the Cradle project root.

The adapter is a persistence port, not a Cell-domain replacement. Its public
boundary remains the existing operation-store methods: `create`, `get`, `list`,
`update`, `reconcileInterrupted`, and `close`. Operation context, result, error,
and cancellation details remain JSON-shaped at the application boundary while
status, progress, lifecycle stage, Cell life state, and timestamps are indexed
columns.

SQLite is configured with WAL mode, `busy_timeout=5000`, and
`synchronous=NORMAL`. WAL keeps readers from blocking the short operation
metadata writes; `NORMAL` is an explicit durability/latency tradeoff, not a
claim of synchronous fsync after every progress update.

## Restart semantics

Completed, failed, and cancelled operations are restored as-is. Accepted,
running, or cancelling operations cannot safely resume an LLM process after a
server restart, so startup marks them `failed` with
`OPERATION_INTERRUPTED`; stimulus cultivation receives `needs_attention` and
must be retried or reviewed. Cell state reconciliation remains authoritative for
the Cell itself.

The database stores metadata only. Source bytes, Memory, observations, and
Artifact contents continue to use their existing file/blob stores. The API
runtime also injects `SqliteCellCultivationStateStore` and
`SqliteCellLifecycleEventStore`. On first read they migrate matching legacy
`cultivation-state.json` and `lifecycle-events.json` records, then use SQLite
as the state/event authority for that API process. Lifecycle events are
append-only rows, so concurrent writes do not use the old read-modify-write
JSON pattern. CLI-only runtimes retain the existing file-backed stores until
they are given the same persistence configuration. Inbox indexes and other
Cell stores remain on their existing boundaries for the next slices; large
content still does not move into SQLite.

Artifact metadata also has a derived SQLite catalog (`artifact_records`) with
the owning Cell, type, title, goal, status, current revision, storage
directory, and output paths. The filesystem manifest and blobs remain
authoritative. Catalog failures are non-fatal and can be repaired by a future
manifest reconciliation pass.

## Performance boundary

Use `npm run benchmark:persistence --workspace=cradle-server` to compare the
current in-memory and SQLite metadata paths under the same synthetic workload.
The benchmark is current-state evidence only; it does not represent LLM,
filesystem content, or network latency and must not be used to claim a
cultivation speedup.
