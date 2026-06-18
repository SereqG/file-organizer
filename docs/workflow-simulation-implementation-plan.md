# Workflow Simulation & Dry-Run — Implementation Plan

> Status: planning. This document is the implementation brief for an AI coding agent.
> Read it top-to-bottom before writing code. It references real symbols and file paths in
> the current codebase; verify they still exist before editing.

---

## 1. Problem statement

Two user-facing gaps:

1. **Authoring blindness.** When you open a downstream node's config modal, its path pickers
   (`FolderPicker`, `ParentFolderField`, target fields) are populated from the *originally scanned
   real filesystem* (`workspaceTree: FileTreeNode`, threaded `WorkspaceSection → WorkflowEditor →
   *ConfigModal → picker`). They have no idea that an upstream **Create Folder** will produce a new
   folder, or that an upstream **Delete/Move/Rename** changed the tree. So you cannot point node B
   at a folder node A creates, and you can still point at a folder node A removes.

2. **Weak simulation output.** A dry-run already exists (`mode: "dryRun"`, see §2), but the preview
   (`WorkflowPreviewModal`) only renders a **flat list of operations**. The user wants the
   **resulting workspace shape** (a tree) and, per node, the **workspace state after the previous
   nodes run**.

Two cross-cutting requirements the user confirmed:

- **Consistency.** The plan shown in the preview must match what the real run does. Today preview
  and run are two independent scans + executions, so they can diverge.
- **AI determinism + caching.** AI Classifier nodes must call the real model during simulation, but
  results must be **cached** (so re-simulating doesn't re-bill) and **invalidated when inputs
  change**. Cache is **in-memory** (accepted by the user; no persistence required).

---

## 2. What already exists (do not rebuild)

Anchor the work on the existing dry-run machinery.

### Backend
- `apps/backend/app/modules/workflows/application/execute_workflow.py`
  - `execute_workflow(workflow, context)` walks the reachable subgraph in topological order.
  - `ExecutionContext.dry_run: bool` — when `True`, node handlers **skip disk syscalls** but still
    mutate `context.items` (the virtual tree) and append `PlannedAction`s.
  - `_dispatch()` diffs `context.items` ids before/after a handler to derive `produced_ids` /
    `removed_ids`, which flow into downstream node scope. **Nodes already see upstream changes at
    runtime** (proven by `tests/test_dry_run.py::test_dry_run_chains_predicted_tree_across_nodes`).
  - In-run config remaps: after a Move, `apply_config_remaps_to_nodes()` rewrites not-yet-executed
    nodes' path configs.
- `apps/backend/app/modules/workflows/domain/models.py`
  - `ExecutionContext` (fields: `items`, `actions`, `warnings`, `config_remaps`, `dry_run`,
    `request_decision`, `on_node_start`, `log_entries`, `root_path`, `execution_id`, …).
  - `WorkflowItem` (`id`, `type` ∈ {`file`,`directory`}, `path`, `name`, `parent_path`, `extension`,
    `size`, `created_at`, `modified_at`, `accessed_at`, `mime_type`, flags, `children_count`,
    `depth`).
  - `PlannedAction` (`node_id`, `kind` ∈ {create,delete,rename,reuse,move,copy,skip}, `description`,
    `item_path`, `target_path`).
- `apps/backend/app/modules/workflows/api/router.py`
  - `POST /workflows/api/execute` with `mode: "dryRun"` → runs with `dry_run=True`, returns
    `_dry_run_preview()` = `{ executionId, mode, ok, error, actions[], warnings[], failedNodes[],
    configRemap[] }`. **It currently discards the resulting tree.**
  - The completed-run serializer `_serialize_state()` already returns `items` as
    `[vars(item) …]` — reuse this pattern for tree serialization.
- AI: `apps/backend/app/modules/ai/application/classifier.py::classify_items()` batches items
  (size 4) and calls `_classify_batch() → client.chat.completions.create()`
  (`ai/infrastructure/openrouter_client.py::get_client()` builds a fresh `OpenAI` client per call).
  **No caching today.** `WorkflowItem.id` is a `uuid4` regenerated on every scan — **not** a stable
  cache key.

### Frontend
- `apps/frontend/components/WorkflowEditor.tsx` owns `workspaceTree` and passes it to every config
  modal. `workspaceTree` originates from the explore job (`useExploreJob`) — the real scan.
- `apps/frontend/components/RuntimeControls.tsx`:
  - `handleRun()` → `previewWorkflow()` (`mode: 'dryRun'`) → `setPreview()` → `WorkflowPreviewModal`.
  - `handleConfirm()` → `execution.start()` (`mode: 'run'`, in `useWorkflowExecution.ts`).
  - `resolveAiClassifierCategories()` expands `config.categoryIds` → full category objects from the
    localStorage library before sending. **The same `pendingResolvedNodes` is sent in both preview
    and run** — important for the consistency guard (§6).
- `apps/frontend/lib/types/workflow.ts`: `WorkflowPreview`, `PlannedAction`, `ExecutionResult`.
- `apps/frontend/lib/types/explore.ts`: `FileTreeNode` (`id`,`name`,`path`,`type`,`level`,
  `extension`,`size`,`skipped`,`skipped_reason`,`children`) — the shape every picker consumes.

---

## 3. Goals / non-goals

**Goals**
- G1. Engine can emit the **predicted tree on entry to a chosen node** (the "state after previous
  nodes") and the **final predicted tree**.
- G2. Config-modal pickers consume the **predicted tree at that node** instead of the raw scan.
- G3. Preview modal shows the **final predicted tree shape** in addition to the action list.
- G4. Real run only proceeds when the workspace + workflow are **identical** to what the preview
  saw; otherwise force a re-preview (consistency guard).
- G5. AI classification is **cached in memory**, keyed on **content fingerprints**, so re-simulation
  is free and changed inputs are re-classified automatically.
- G6. Dry-run **fidelity fixes** so the predicted tree and predicted failures match a real run when
  upstream nodes virtually created/removed/relocated paths.

**Non-goals (explicitly out of scope)**
- Persisting the AI cache to disk (in-memory only).
- A replay VM / per-action precondition engine (we use a fingerprint guard instead — §6).
- Multi-process / durable executions (the store stays single-process, per its docstring).
- Loops (engine still rejects cycles).

---

## 4. Architecture overview

```
                       ┌─────────────────────────── backend ───────────────────────────┐
 editor opens          │                                                                │
 config modal for X ──▶ POST /execute {mode:dryRun, stopBefore:X}                        │
                       │   scan_directory → context.items                                │
                       │   execute_workflow(stop_before=X)                               │
                       │     · walk topo order                                           │
                       │     · on reaching X: snapshot context.items, capture scope, halt│
                       │   serialize snapshot → nested FileTreeNode                       │
                       │   return {predictedTree, scopeItemIds, ok, error}               │
 picker uses           ◀────────────────────────────────────────────────────────────────
 predictedTree

 Run button ─────────▶ POST /execute {mode:dryRun}                                        │
                       │   execute whole graph (dry) → finalTree + actions + previewToken │
 preview modal shows   ◀────────────────────────────────────────────────────────────────
 tree + actions
       │ confirm (carries previewToken)
       ▼
 Run ───────────────▶ POST /execute {mode:run, previewToken}                              │
                       │   re-scan, recompute token, compare → 409 if stale               │
                       │   else start_execution(...)  (AI cache hits ⇒ run == preview)     │
                       └──────────────────────────────────────────────────────────────────┘
```

Key idea: we **do not** persist the dry-run context. Consistency is enforced by (a) the
`previewToken` fingerprint guard and (b) the in-memory AI cache surviving between the two requests
(both are module-global / disk-derived).

---

## 5. Workstreams

Deliver in the order below. Each is independently testable.

### Workstream 1 — Engine: per-node snapshot + tree serialization (backend)

**5.1.1 `execute_workflow` stop-before + snapshot capture**

In `execute_workflow.py`:

- Add an optional parameter: `def execute_workflow(workflow, context, *, stop_before: Optional[str] = None)`.
- In the main loop, **before** running the node body for `node_id == stop_before`:
  - Record the snapshot and halt. The snapshot is the **deep copy** of `context.items` *as it
    stands on entry to X* — i.e. after all topologically-earlier nodes have mutated the tree but
    before X runs. This is exactly "workspace state after previous nodes run".
  - Capture the scope arriving at X: `incoming.get(node_id, set())`.
  - Store both on the context (new fields below) and `break` out of the loop. Do **not** dispatch X.
- Deep copy: `WorkflowItem` is a flat dataclass with `datetime` fields → `copy.deepcopy(context.items)`
  is correct and sufficient. (Do not store references — rename/move mutate items in place.)

Add to `ExecutionContext` (domain/models.py):
```python
# Filled only when execute_workflow is called with stop_before. The tree state on entry to that
# node (a deep copy, because nodes mutate items in place) and the item ids in scope there.
snapshot_items: Optional[list[WorkflowItem]] = None
snapshot_scope_ids: set[str] = field(default_factory=set)
```

> Rationale for `stop_before` (vs. capturing every node's snapshot into a dict): the editor only
> needs **one** node's tree at a time, and stopping early avoids running X and everything downstream
> of it — critically, it avoids firing **AI Classifier** nodes that sit after X (cost + latency).
> The full-graph dry-run (Run button) still runs to completion and returns the final tree.

**5.1.2 Final-tree capture**

For the full-graph dry-run, the final tree is simply `context.items` at the end of
`execute_workflow`. No new storage needed — the API serializer reads `context.items`.

**5.1.3 Flat-items → nested `FileTreeNode` serializer**

New module: `apps/backend/app/modules/workflows/application/item_tree.py`.

```python
def items_to_tree(items: list[WorkflowItem], root_path: str) -> Optional[dict]:
    """Build a nested FileTreeNode-shaped dict from a flat WorkflowItem list.
    Returns None if the root_path item is absent (empty/invalid tree)."""
```

Rules:
- Index items by `path`. The root node is the item whose `path == root_path` (fallback: the item
  with minimum `depth`).
- Children of a node N = items whose `parent_path == N.path`. Sort children: directories first,
  then by `name` ascending (match picker expectations; verify against `FolderPicker` ordering).
- Output keys must match `FileTreeNode` (explore.ts): `id`, `name`, `path`, `type`, `level`
  (= `WorkflowItem.depth`), `extension`, `size`, `skipped: False`, `skipped_reason: None`,
  `children`.
- Predicted-created folders carry their real-ish `path` and a `uuid` id; linking is purely by
  `path`/`parent_path`, so they slot in correctly. Moved items have updated `parent_path`/`name`
  (via `relocate_item_paths`), so they nest under their new parent.

**Tests:** `tests/test_item_tree.py` — flat list (incl. a created folder + a moved item) → correct
nesting, ordering, `level` mapping, and `None` on missing root.

---

### Workstream 2 — Dry-run fidelity fixes (backend)

The predicted tree must reflect *virtual* upstream changes, but several node handlers check the
**real disk** for existence/collisions even under `dry_run`. This makes predicted trees and
predicted failures diverge from a real run once an upstream node virtually created/removed a path.

**5.2.1 Shared helper** in `nodes/folder_helpers.py` (or a small `nodes/tree_lookup.py`):
```python
def path_exists_in_tree(context: ExecutionContext, path: str) -> bool:
    return any(i.path == path for i in context.items)
```

**5.2.2 Audit & fix each handler's existence/collision check so that under `context.dry_run` it
consults the virtual tree, and under a real run it keeps using the disk:**

- `nodes/create_folder.py`: `target_path.exists()` (line ~64) and the `overwrite`/`reuse_existing`
  branches. Under dry-run, existence must come from `path_exists_in_tree`, not `Path.exists()`.
  Otherwise an upstream-created folder won't be detected as a collision, and chained creates predict
  wrongly.
- `nodes/rename_file.py`, `nodes/rename_folder.py`: collision target `.exists()` checks.
- `nodes/move.py` / `nodes/copy.py`: `dest.exists()` collision checks (move.py line ~72,
  `claimed` set already covers in-run dest reuse; extend with virtual-tree existence under dry-run).
  Note these already guard staging/`shutil` behind `not context.dry_run` — leave those; only the
  **existence predicates** need to be virtual-aware.
- `classify_skip()` in `transfer_helpers.py` already tolerates dry-run (its `os.stat` is wrapped in
  `try/except OSError`). Leave as-is but add a regression test.

**Principle:** in dry-run, "does this path exist?" means "is it in `context.items`?" (the virtual
tree), never the disk. In a real run, keep using the disk.

**Tests:** extend `tests/test_dry_run.py`:
- create folder `tmp`, then create folder `tmp` again with `ifExists=fail` → predicts the
  "already exists" failure purely from the virtual tree (nothing on disk).
- create folder `A/x`, then move a file into `A/x` (a virtually-created dir) → predicted move
  targets the virtual folder, tree nests correctly.

---

### Workstream 3 — AI classification cache (backend)

New module: `apps/backend/app/modules/ai/application/classification_cache.py`. Stays inside the AI
slice per the AI isolation rule in `CLAUDE.md`.

**5.3.1 Fingerprints**

```python
_CACHE_VERSION = 1   # bump to invalidate everything (e.g. prompt change)

def item_fingerprint(item: WorkflowItem) -> str:
    # Content-change proxy. NOTE: excludes path (so the same file reuses its score regardless of
    # where it sits), includes name (the model is shown the name, not the path).
    # size + modified_at catch content edits.
    parts = (item.type, item.name, item.extension or "", item.mime_type or "",
             str(item.size or 0), item.modified_at.isoformat() if item.modified_at else "")
    return sha256("\x1f".join(parts))

def category_fingerprint(cat: Category) -> str:
    parts = (cat.id, cat.name, cat.description, cat.item_type,
             ",".join(sorted(cat.extensions)), cat.min_confidence)
    return sha256("\x1f".join(parts))
```

- Key = `(_CACHE_VERSION, model_name, item_fingerprint, category_fingerprint)`.
- **Cache raw confidence scores, not buckets.** `allowDuplicate` and the confidence thresholds are
  applied *after* scoring (`_build_buckets`, `_resolve_batch_results`), so they must NOT be part of
  the key — changing them must reuse cached scores.
- `model_name` = `settings.openrouter_model`. Include it so switching models doesn't reuse scores.

**5.3.2 Store**

```python
_scores: dict[tuple[int, str, str, str], float] = {}
_lock = threading.Lock()

def get(model, item_fp, cat_fp) -> Optional[float]: ...
def put(model, item_fp, cat_fp, confidence: float) -> None: ...
def clear() -> None: ...     # for tests
```

`threading.Lock` is required: the full run executes in a threadpool worker
(`execute_resumable._run` → `run_in_executor`), while the `stopBefore` dry-run for the editor runs
synchronously in the event-loop thread. Both can touch the cache.

Unbounded growth is acceptable for now (single workspace, in-memory). Leave a `# TODO: cap with LRU`
note; do not implement eviction.

**5.3.3 Integration in `classifier.py`**

Refactor `classify_items()` so the per-`(item, candidate-category)` score lookup is cache-first:

1. After the pre-filter builds `candidates: dict[item_id → set[cat_id]]`, compute fingerprints for
   each in-scope item and each category once (memoize in local dicts).
2. Build `score_map: dict[(item_id, cat_id) → float]` by reading the cache for every
   `(item, candidate-cat)` pair.
3. Collect **misses**: pairs with no cached score. An item is "dirty" if it has ≥1 missing pair.
4. Build batches **only from dirty items**. For each dirty item, send only its **missing**
   categories to the model (keeps prompts minimal; `_classify_batch` already takes the relevant cat
   subset). Reuse existing batching (size `_BATCH_SIZE`).
5. On each batch response, `put()` every returned `(item, cat) → confidence` into the cache and into
   `score_map`.
6. Build buckets from the **complete** `score_map` (cache ∪ fresh) via the existing `_build_buckets`.

**Streaming callback parity:** `on_items_classified` must still fire for items resolved purely from
cache (so logs/preview show them). Today it's only called per-batch. Add a path that, for
cache-only items (no batch), calls `_resolve_batch_results(...)`-equivalent using the cached scores
and invokes the callback. Ensure every in-scope item triggers exactly one callback result
(classified or unclassified), whether cached or fresh.

**This is the "validation if input changed" mechanism:** a changed file → new `modified_at`/`size`
→ new `item_fingerprint` → cache miss → re-call for that item only. A changed category description
→ new `category_fingerprint` → miss. No separate change-detection pass.

**Tests:** `tests/test_classification_cache.py` (mock `get_client`/`_classify_batch` to count calls):
- First classify of N items → 1 model pass; second identical classify → **0** model passes, same
  buckets.
- Change one item's `modified_at` → only that item re-sent.
- Change a category description → all items re-scored for that category.
- Change `allowDuplicate` or `min_confidence` thresholds → **0** model passes (scores reused),
  buckets reflect the new threshold/duplicate setting.
- `clear()` empties the cache.

---

### Workstream 4 — Preview/run consistency guard (backend + frontend)

The run must execute against the same workspace + workflow the preview saw.

**5.4.1 Fingerprint + token** — new `apps/backend/app/modules/workflows/application/preview_token.py`:

```python
def workspace_fingerprint(items: list[WorkflowItem], scope_paths: Optional[set[str]] = None) -> str:
    """sha256 over sorted (path, size, modified_at) of items. When scope_paths is given, restrict to
    items whose path is at/under one of those roots (reduces false invalidation — see note)."""

def workflow_hash(workflow_request_dict: dict) -> str:
    """Stable sha256 over the as-posted workflow (nodes incl. config, edges, trigger).
    Compute from the raw request BEFORE any in-run config_remap mutation."""

def preview_token(ws_fp: str, wf_hash: str) -> str:
    return sha256(ws_fp + "\x1f" + wf_hash)
```

**5.4.2 API wiring** in `router.py`:
- `ExecuteWorkflowRequest`: add `previewToken: Optional[str] = None`.
- Dry-run path (full graph): compute `workspace_fingerprint(context.items)` from the fresh scan and
  `workflow_hash` from the request; return `previewToken` in `_dry_run_preview()`.
- Run path: **before** `start_execution`, recompute `workspace_fingerprint` (the scan already
  happened at `context.items = scan_directory(...)`) + `workflow_hash`, derive the token, and
  compare to `body.previewToken`:
  - Missing token → reject `409 {error: "Run requires a fresh preview.", code: "PREVIEW_REQUIRED"}`.
  - Mismatch → `409 {error: "The workspace or workflow changed since the preview. Review again.",
    code: "PREVIEW_STALE"}`.
  - Match → proceed.

> **Scope-narrowing refinement (recommended default):** computing the fingerprint over the *entire*
> workspace means any unrelated file change forces a re-preview. Narrow it to the paths the workflow
> touches: the set of `action.item_path` / `action.target_path` (and their parent dirs) recorded
> during the dry-run, plus every configured path in the workflow. Persisting that set across the two
> requests is awkward (we don't keep the dry-run context), so the pragmatic implementation is:
> recompute the touched-path set on the run side too (it's derivable from the workflow config alone
> for most nodes; for the action-derived paths, accept whole-workspace fingerprinting as the safe
> default). **Default to whole-workspace fingerprinting** for correctness; treat scope-narrowing as
> a follow-up optimization, gated behind a clear test.

**5.4.3 Frontend**
- `lib/types/workflow.ts`: add `previewToken?: string` to `WorkflowPreview`.
- `RuntimeControls.previewWorkflow()`: read `data.previewToken` into the preview.
- `RuntimeControls.handleConfirm()` → pass the token into `execution.start(...)`.
- `useWorkflowExecution.start(definition, rootPath, previewToken?)`: include `previewToken` in the
  `mode: 'run'` POST body.
- Handle `409`: if `res.status === 409`, surface the `error`/`code` to the user and re-open the
  preview gate (force a fresh `handleRun`). Do **not** silently start.

**Why this also fixes AI consistency:** if the token matches, every file is byte-identical
(metadata-wise) → AI fingerprints match → the run's classification is served from the cache the
preview populated → identical routing. No extra work needed.

**Tests:** `tests/test_preview_token.py` + an API-level test:
- token round-trips and matches when nothing changed;
- mutating a file's mtime/size → run rejected `PREVIEW_STALE`;
- changing a node config → `workflow_hash` changes → rejected;
- missing token on run → `PREVIEW_REQUIRED`.

---

### Workstream 5 — Frontend: simulation context, picker rewiring, per-node tree (frontend)

**5.5.1 API route passthrough.** The dry-run already routes through
`app/api/workflows/execute/route.ts`. Confirm it forwards arbitrary body fields (`stopBefore`,
`previewToken`) to the backend; extend if it whitelists fields.

**5.5.2 `useWorkflowSimulation` hook** — `apps/frontend/hooks/useWorkflowSimulation.ts`:
- Input: the current `WorkflowDefinition` + `rootPath` + the same `resolveAiClassifierCategories`
  expansion used in `RuntimeControls` (extract that helper to a shared util so preview, run, and
  per-node sim all send identical node configs).
- `simulateNode(nodeId): Promise<{ tree: FileTreeNode | null; scopeItemIds: string[]; ok: boolean;
  error: string | null }>` — POSTs `mode:'dryRun', stopBefore: nodeId`.
- Memoize on a **definition hash** (hash of nodes+edges+configs): if unchanged since the last sim
  for that node, return the cached result (avoids redundant AI calls; backend AI cache covers the
  rest).
- Expose `loading` and `error` per call.

**5.5.3 Predicted tree for config modals.**
- In `WorkflowEditor.tsx`, replace the static `workspaceTree={workspaceTree}` passed to each config
  modal with a **per-node resolved tree**:
  - When a modal opens for node X, call `simulateNode(X)`.
  - While loading → show a spinner inside the modal's picker area (the modals already render their
    own bodies; add a `treeLoading`/`treeError` prop, or wrap the picker).
  - On success → pass `predictedTree` as the modal's `workspaceTree`.
  - On `ok:false` / `tree:null` (upstream invalid or X unreachable from trigger) → **fall back to the
    raw `workspaceTree`** and show a non-blocking banner: *"Showing the current filesystem.
    Connect/Configure upstream nodes to preview their changes here."* Include `error` when present.
- No change needed to the pickers themselves — they already accept `root: FileTreeNode` and select
  by `path`, which is stable across virtual creations/moves.

> **Authoring constraint to document in the UI:** X's predicted tree only exists once X is reachable
> from the trigger and its entire upstream chain is configured & valid (otherwise the dry-run aborts
> before reaching X). This is expected, not a bug — surface it via the fallback banner.

**5.5.4 Per-node "state after previous nodes" + scope.**
- The modal's picker now shows the predicted tree (that IS "state after previous nodes").
- Optionally add a small read-only panel in each config modal: *"Items entering this node: N"* —
  resolve `scopeItemIds` against the predicted tree and list names. (Bonus; the user's explicit
  ask is the tree. Keep it behind the same `simulateNode` result.)

**5.5.5 Final-tree in the preview modal (problem #2).**
- Backend full-graph dry-run already returns the final tree (Workstream 1.2 + serializer).
  Add `finalTree?: FileTreeNode | null` to `WorkflowPreview` and the `_dry_run_preview()` payload.
- `WorkflowPreviewModal.tsx`: add a **tree view** of `finalTree` alongside the existing action list
  (e.g. a tabbed or split layout: "Changes" list + "Result" tree). Reuse the read-only tree
  rendering primitives (`FileTree`/`FileTreeNodeItem`) where possible; do not make it selectable.

---

## 6. API contract (exact)

### `POST /workflows/api/execute`

Request (`ExecuteWorkflowRequest`):
```jsonc
{
  "workflow": { "nodes": [...], "edges": [...], "trigger": {...} },
  "rootPath": "string",
  "mode": "run" | "dryRun",          // default "run"
  "stopBefore": "nodeId" | null,      // dryRun only; capture entry snapshot of this node and halt
  "previewToken": "string" | null     // run only; consistency guard
}
```

Response — `mode:"dryRun"`, **no** `stopBefore` (full-graph preview):
```jsonc
{
  "executionId": "uuid",
  "mode": "dryRun",
  "ok": true,
  "error": null,
  "actions": [ { "nodeId","kind","description","itemPath","targetPath" } ],
  "warnings": [ ... ],
  "failedNodes": [ { "id","error" } ],
  "configRemap": [ { "oldPath","newPath" } ],
  "finalTree": { /* FileTreeNode */ } | null,
  "previewToken": "string"
}
```

Response — `mode:"dryRun"` **with** `stopBefore: X` (per-node, for the editor):
```jsonc
{
  "executionId": "uuid",
  "mode": "dryRun",
  "ok": true,                          // false if upstream aborted before reaching X
  "error": null | "string",
  "predictedTree": { /* FileTreeNode */ } | null,  // tree on ENTRY to X
  "scopeItemIds": ["itemId", ...],     // ids (within predictedTree) in scope at X
  "warnings": [ ... ]
}
```

Response — `mode:"run"`: unchanged `202 {executionId,status}`, **or** `409 {error, code}` where
`code ∈ {PREVIEW_REQUIRED, PREVIEW_STALE}`.

> When `stopBefore` is set, do not run X or anything downstream; in particular **AI Classifier nodes
> after X never fire**. AI nodes *before* X do fire (real model, cached).

---

## 7. Data-structure changes (summary)

**Backend `domain/models.py`**
- `ExecutionContext.snapshot_items: Optional[list[WorkflowItem]] = None`
- `ExecutionContext.snapshot_scope_ids: set[str] = field(default_factory=set)`

**Backend `execute_workflow.py`**
- `execute_workflow(workflow, context, *, stop_before: Optional[str] = None)`

**Frontend `lib/types/workflow.ts`**
- `WorkflowPreview`: add `finalTree?: FileTreeNode | null`, `previewToken?: string`.
- New `NodeSimulationResult` interface: `{ tree: FileTreeNode | null; scopeItemIds: string[];
  ok: boolean; error: string | null }`.

**New files**
- `apps/backend/app/modules/workflows/application/item_tree.py`
- `apps/backend/app/modules/workflows/application/preview_token.py`
- `apps/backend/app/modules/ai/application/classification_cache.py`
- `apps/frontend/hooks/useWorkflowSimulation.ts`
- shared util extracted from `RuntimeControls` for AI-category resolution + node serialization
  (e.g. `apps/frontend/lib/workflow/resolveRunNodes.ts`).

---

## 8. Sequencing / staged delivery

Each stage compiles, passes tests, and is shippable on its own.

1. **Stage 1 — Engine snapshot + serializer (WS1).** `stop_before`, `snapshot_*`, `item_tree.py`.
   No UI yet. Tests prove snapshot correctness.
2. **Stage 2 — Dry-run fidelity (WS2).** Virtual-tree existence checks. Tests prove chained
   create/move/rename predictions.
3. **Stage 3 — AI cache (WS3).** Cache + classifier refactor. Tests prove call-count + invalidation.
4. **Stage 4 — Consistency guard (WS4).** Token compute + 409 handling, frontend token passthrough.
5. **Stage 5 — Editor wiring (WS5).** `useWorkflowSimulation`, predicted-tree pickers, final-tree in
   preview modal, scope panel.

Stages 1–3 are pure backend and can land before any frontend work. Stage 4 needs a tiny frontend
change (token passthrough + 409 handling). Stage 5 is the bulk of the frontend.

---

## 9. Risks, caveats & decisions

- **Topological order is not unique.** "Tree before X" depends on the order the engine ran
  independent branches. Fine for a preview; document it as one valid ordering, not a guarantee, when
  two parallel branches do conflicting FS work.
- **Per-node sim cost.** Opening a config modal downstream of an AI node triggers a dry-run that may
  call the model. Mitigations: `stopBefore` stops before X (so AI nodes *after* X never fire);
  definition-hash memoization in `useWorkflowSimulation`; the in-memory AI cache. Always show a
  loading state.
- **Whole-workspace fingerprint is strict.** Any unrelated change forces a re-preview. This is the
  safe default the user asked for ("I care about consistency"). Scope-narrowing (§5.4.2 note) is a
  follow-up.
- **AI cache is unbounded + process-local.** Accepted (in-memory). Lost on restart; add an LRU cap
  later if memory becomes a concern.
- **Snapshot memory.** Per-node sim deep-copies `context.items` once (at X). Bounded by one tree;
  acceptable. (We deliberately avoided storing *all* nodes' snapshots.)
- **Open decision — staleness UX:** default is abort + re-preview on any drift. If that proves
  annoying in practice, switch to scope-narrowed fingerprinting (preferred) before relaxing to
  warn-and-continue.

---

## 10. Definition of done

- Engine returns a correct per-node entry tree (`stopBefore`) and a correct final tree; serializer
  matches `FileTreeNode`.
- Config-modal pickers show the predicted tree at that node, with graceful fallback + banner when
  unavailable.
- Preview modal shows the resulting tree shape alongside the action list.
- Run is rejected with a clear message when the workspace or workflow changed since the preview.
- AI classification is served from an in-memory, content-fingerprinted cache; changed inputs
  re-classify automatically; thresholds/duplicate changes reuse scores.
- Dry-run predictions (trees + failures) match a real run for chained create/delete/move/rename.
- New tests pass: `test_item_tree.py`, extended `test_dry_run.py`, `test_classification_cache.py`,
  `test_preview_token.py`, plus an API test for the 409 guard. Existing suites stay green
  (`test_execute_workflow`, `test_resumable`, `test_move`, `test_copy`, `test_conditions`,
  `test_warnings`, `test_live_item_tree`, `test_file_nodes`).
- Adheres to `CLAUDE.md`: small focused files, AI logic isolated in the AI slice, no dead code,
  meaningful errors, single-responsibility functions.
```
