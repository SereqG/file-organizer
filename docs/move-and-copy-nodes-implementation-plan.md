# Implementation Plan — Move & Copy Nodes (+ Live Item Tree & Warnings)

> **This document is a prompt for a Claude Code agent.** Implement it stage by stage,
> in order. Each stage is independently shippable and must be verified (lint + tests +
> manual reasoning) before starting the next. Follow the repository `CLAUDE.md` at all
> times: vertical slices, small composable functions, no dead code, refactor duplicated
> logic early, no swallowed errors, validate all file input. If anything below is
> ambiguous or conflicts with the current code, **stop and ask** rather than guessing.

---

## 0. Background & agreed decisions

We are adding two filesystem nodes to the workflow engine:

- **Move** — relocates the items flowing into it to **one** target directory.
- **Copy** — duplicates the items flowing into it into **one or many** target directories,
  with a `keepOriginal` toggle (default **true**).

`Copy` with `keepOriginal=false` and a single target is effectively a "distribute/move";
`Copy` and `Move` therefore **share one core engine** with two thin handlers. The only real
differences are the filesystem op (relocate vs duplicate) and the runtime-tree bookkeeping
(mutate an item's path vs append new items).

Two pieces of shared infrastructure must land first because both new nodes depend on them:

1. A **live item tree** — `context.items` (and the `item_by_id` lookup) must stay current
   after every node so later nodes operate on fresh data, and **newly produced items must
   always flow downstream as "encountered" scope**.
2. A **warnings channel** — non-fatal, per-item warnings surfaced from a node all the way to
   the UI (Move/Copy auto-skip invalid items and report them as warnings).

### Decisions locked during design (do not re-litigate)

| Topic | Decision |
|---|---|
| Node split | Two nodes: `Move` (single target) and `Copy` (1..N targets, `keepOriginal` default `true`). Shared core. |
| Directory partially in scope | **Scope-faithful**: move/copy a directory *as a unit* only when its **entire** subtree is in scope; otherwise act on the in-scope children individually (recursively). |
| Parent-into-descendant | **Pre-flight classification**, no mid-run pausing. Detect statically and **skip + warn**. |
| Target name collision (pre-existing) | Reuse `fail` / `rename_incrementally` / `overwrite` and **add `skip`**. |
| Collision between two moved/copied items (same batch) | Same `ifExists` knob governs it (one field, documented as order-dependent for `overwrite`). |
| Cross-filesystem | **Move**: not supported — detect (`st_dev` mismatch) and **skip + warn**. **Copy**: allowed (duplication is inherently copy-based). |
| Target directory is itself in the move/copy scope | Validate and **skip that target** + warn. |
| No-op (item already lives directly in target) | **Skip + inform** (warning). |
| Path rewriting | **Safe rewrite**: rewrite live `context.items` paths only. **Never** rewrite other nodes' `config` paths. |
| Produced items → downstream "encountered" scope | **Always** join scope. (Accepted footgun: `Create Folder → Delete all encountered` would now delete the just-created folder. This is intended.) |
| Pre-flight UX | **Auto-skip-and-warn**, no interactive confirm. (A true pre-run preview gate is out of scope.) |
| Mid-run failure (permission, etc.) | Keep existing **all-or-nothing rollback** (`undo_stack`/`unwind`). Warnings are for the *skipped-but-fine* cases only. |

### Key files (current state)

Backend:
- `apps/backend/app/modules/workflows/application/execute_workflow.py` — engine, dispatch, scope propagation, `NodeExecutionResult`, `WorkflowExecutionResult`.
- `apps/backend/app/modules/workflows/domain/models.py` — `WorkflowItem`, `ExecutionContext`, `WorkflowNode`.
- `apps/backend/app/modules/workflows/application/nodes/` — `create_folder.py`, `delete_folder.py`, `delete_file.py`, `rename_folder.py`, `rename_file.py`, `folder_helpers.py`, `file_helpers.py`.
- `apps/backend/app/modules/workflows/application/scan_directory.py` — builds `WorkflowItem`s from a path (reuse for Copy subtree registration).
- `apps/backend/app/modules/workflows/api/router.py` — `/workflows/api/execute` request/response shapes.

Frontend:
- `apps/frontend/lib/types/workflow.ts` — node config types, `WorkflowNodeType`, `ExecutionResult`/`ExecutionFailedNode`.
- `apps/frontend/lib/workflow/registry/nodeCatalog.tsx` — sidebar catalog.
- `apps/frontend/hooks/useWorkflowEditor.ts` — `NODE_TYPES` ReactFlow registry, `AppNode` union, failed-node marking.
- `apps/frontend/hooks/useWorkflowDefinition.ts` — node factories/defaults + per-type `update*NodeConfig`.
- `apps/frontend/components/WorkflowEditor.tsx` — per-type config-modal dispatch.
- `apps/frontend/components/nodes/create_folder_node/` — single-folder picker pattern (`FolderPicker`, `ParentFolderField`, `IfExistsField`, `ValidationMessages`, `ActionButtons`).
- `apps/frontend/components/nodes/delete_folder_node/` — multi-folder picker pattern (`MultiFolderPicker`), `useDeleteFolderConfig`, `validateDeleteFolderConfig`.
- `apps/frontend/components/RuntimeControls.tsx` + `components/ExecutionResultPopup.tsx` — execution call + result display.

> Before editing the frontend, read the relevant guide under `node_modules/next/dist/docs/`
> as instructed by `apps/frontend/AGENTS.md` — this Next.js has breaking changes.

---

## Stage 1 — Engine: live item tree + scope propagation

**Goal:** after each node runs, the runtime tree reflects reality, the `item_by_id` lookup is
never stale, and items a node *produces* always flow into downstream scope.

### 1.1 The bug to fix
`execute_workflow.py` builds `item_by_id` **once** (`item_by_id = {item.id: item for item in context.items}`)
and the `If`/`Switch` routing (`_route_partitioned`) reads from that frozen snapshot. New items
(from `create_folder`, and soon `Copy`) never enter it, and they never enter any downstream
`incoming` scope set either, so they are invisible to later nodes. Renames mutate item objects
in place (so paths are visible through the snapshot by luck), but deletes leave stale objects in
the lookup. Make the tree the single, live source of truth.

### 1.2 Extend the node contract with deltas
Action node handlers currently return `(error, undo, commit)`. Extend the engine-facing result
so a node reports **what it produced and what it removed** (by item, or by id). Preferred shape —
add fields to `NodeExecutionResult` rather than widening every tuple, to keep changes localized:

- Introduce a small result object (or extend `NodeExecutionResult`) carrying:
  - `error: Optional[str]`
  - `undo: Optional[Callable]`
  - `commit: Optional[Callable]`
  - `produced_ids: set[str]` (default empty) — items newly added to `context.items`.
  - `removed_ids: set[str]` (default empty) — items removed from `context.items`.
- Keep the handler signature returning enough for `_dispatch` to populate these. Choose **one**
  consistent mechanism and apply it to **all** handlers (do not mix tuple arities). A clean option:
  handlers keep returning `(error, undo, commit)` **and** record produced/removed ids onto
  `context` via a tiny helper, OR change handlers to return a `NodeExecutionResult`. Pick the
  lower-churn option and make it uniform across the five existing nodes.

### 1.3 Keep `item_by_id` live
After every node, reconcile the lookup: add `produced_ids`, drop `removed_ids`. Since `WorkflowItem`
objects are mutated in place for renames/moves, identity is preserved — only additions/removals
need patching. `_route_partitioned` must read the **live** lookup.

### 1.4 Scope propagation rule
Change downstream scope union (currently `incoming[target] |= scope` at the end of the node loop) to:

```
outgoing_scope = (scope - removed_ids) | produced_ids
for target in out_edges[node_id]:
    incoming[target] |= outgoing_scope
```

`produced_ids` **always** join (locked decision). Removed ids drop out so deleted items don't haunt
downstream filters.

### 1.5 Update the five existing nodes to report deltas
- `create_folder.py` — `produced_ids = {new_item.id}`. (In `reuse_existing` with an existing item,
  produce nothing new.) On `undo`, the engine reconciliation handles removal; ensure the undo still
  cleans `context.items` as today (no double-bookkeeping — pick one owner of the mutation).
- `delete_file.py` / `delete_folder.py` — `removed_ids = {ids of removed items}` (folder includes
  descendants). They already prune `context.items`; just surface the ids.
- `rename_file.py` / `rename_folder.py` — no produced/removed (same ids, mutated path). `produced_ids`
  and `removed_ids` stay empty. Confirm the global path rewrite (`rename_folder._rewrite_paths`) keeps
  the lookup consistent (same objects → fine).

### 1.6 Decide the single owner of `context.items` mutation
Today nodes mutate `context.items` *and* the engine will now track deltas. Avoid double mutation:
either (a) nodes keep mutating `context.items` and merely *report* the delta for `item_by_id`/scope
sync, or (b) nodes only report and the engine mutates. **(a)** is the smaller change. Document the
chosen contract in a short module docstring so future nodes follow it.

### 1.7 Tests (Stage 1)
Locate the existing backend test convention first (search for current tests for `execute_workflow`
/ nodes) and follow it. Add cases:
- Created folder is visible to a downstream node (appears in its scope and in `item_by_id`).
- Deleted items disappear from downstream scope and from routing.
- `If`/`Switch` after a create/delete route correctly against the **live** tree.
- Rename keeps the same id with an updated path downstream.
- Existing node tests still pass (no regressions).

**Acceptance:** all existing flows behave as before *except* produced items now flow downstream;
`item_by_id` is provably live; no node double-mutates the tree.

---

## Stage 2 — Warnings channel

**Goal:** nodes can emit non-fatal, per-item warnings that reach the UI without aborting execution.

### 2.1 Domain
Add a `warnings` list to `ExecutionContext` in `domain/models.py` (it already carries `logs`/`outputs`).
Define a typed warning record (dataclass) with at least:
- `node_id: str`
- `code: str` — stable machine code (see catalogue below).
- `message: str` — human-readable.
- `item_path: Optional[str]`
- `target_path: Optional[str]`

**Warning code catalogue** (used by Move/Copy in later stages — define now):
`PARENT_INTO_DESCENDANT`, `TARGET_IN_SCOPE`, `NO_OP_SAME_LOCATION`, `CROSS_FILESYSTEM`,
`COLLISION_SKIPPED`, `PARTIAL_DIRECTORY` (informational: a partially-in-scope directory was not
moved as a unit; its in-scope children were handled individually).

### 2.2 Engine → result
`WorkflowExecutionResult` gains `warnings: list[...]`. Populate it from `context.warnings` on **both**
the success and the error/rollback paths (warnings collected before a later fatal error are still
informative, but if the run rolls back, make the semantics explicit — recommended: on rollback,
return the fatal error and the warnings accumulated up to that point, clearly distinct from `failed_nodes`).

### 2.3 API (`router.py`)
Add `warnings` to the success JSON response and to the 422 error response. Keep `vars(item)`-style
serialization consistent. Ensure the Next.js proxy route the frontend calls (`/api/workflows/execute`)
forwards the new `warnings` field unchanged — check the route handler under `apps/frontend/app/api/...`.

### 2.4 Frontend
- Extend the `ExecutionResult` type in `lib/types/workflow.ts` with `warnings`.
- `RuntimeControls.tsx` already maps the response into `ExecutionResult`; carry `warnings` through.
- `ExecutionResultPopup.tsx` — render warnings (grouped, non-blocking, visually distinct from
  `failedNodes` errors). Keep it presentational and small; one component per file.

### 2.5 Tests (Stage 2)
- A node appending a warning surfaces it in the API response on a **successful** run.
- Warnings do not set `error`, do not populate `failed_nodes`, and do not trigger rollback.

**Acceptance:** a successful run can carry warnings end-to-end; warnings never abort execution.

---

## Stage 3 — Move node

**Goal:** relocate the in-scope items to one target directory, honoring every edge-case rule.

### 3.1 Config schema
`Move` node `config`:
```ts
type MoveNodeConfig = {
  targetPath: string;                 // single directory, chosen via tree picker
  allowedType: 'files' | 'directories' | 'both';
  ifExists: 'fail' | 'rename_incrementally' | 'overwrite' | 'skip';
};
```
Source items are **always** the encountered scope (no explicit source-path mode). There is no
`keepOriginal` on Move.

### 3.2 Shared core (extract first — DRY per `CLAUDE.md`)
Create a shared module (e.g. `nodes/transfer_helpers.py`) used by both Move and Copy. Promote/centralize:
- `_is_descendant(path, ancestor)` and `_top_level_only(...)` — currently private in `delete_folder.py`;
  move to shared and have `delete_folder` import them (no duplication).
- The prefix path-rewrite from `rename_folder.py` (`_rewrite_prefix` / `_rewrite_paths`) — generalize to
  rewrite an item subtree's paths after a relocation.
- **Scope-faithful root computation** (the heart of edge case 1):
  1. Filter scope item ids → candidate items by `allowedType`.
  2. A directory `D` is **movable as a unit** iff every descendant of `D` present in `context.items`
     is also a candidate (nothing under it was filtered out by an upstream `If`/`Switch` or by `allowedType`).
  3. **Operation roots** = candidates not contained within any other candidate that is movable-as-a-unit.
     - Fully-in-scope dir → single unit root; its descendants are **not** processed again.
     - Partially-in-scope dir → **not** a unit; emit a `PARTIAL_DIRECTORY` info warning and treat its
       in-scope children as their own roots (recurse: a child dir fully in scope becomes a unit).
- **Pre-flight classification** for each root → target pair, producing either an action or a skip+warning:
  - `target == source` or target is a descendant of source → `PARENT_INTO_DESCENDANT`, skip.
  - the chosen target directory is itself one of the items being moved (in scope) → `TARGET_IN_SCOPE`, skip target.
  - source already lives directly inside target (its parent is the target) → `NO_OP_SAME_LOCATION`, skip.
  - source and target on different filesystems (`os.stat(...).st_dev` mismatch) → `CROSS_FILESYSTEM`, skip
    (**Move only**).
  - destination name already taken (pre-existing **or** another item from this same batch) → resolve via
    `ifExists`; `skip` → `COLLISION_SKIPPED` warning.

### 3.3 Execution
For each valid root (after classification):
- Resolve final destination name per `ifExists` (`rename_incrementally` uses the existing
  `resolve_incremental_name` / `resolve_incremental_file_name` helpers; `overwrite` removes the
  conflicting target first — reuse the staging approach so it is undoable).
- `shutil.move(source, dest)`.
- Rewrite paths of the moved item **and all its in-scope descendants** in `context.items`
  (old prefix → new prefix) using the shared rewrite. Same ids preserved → `produced_ids`/`removed_ids`
  stay empty (the moved items continue downstream with fresh paths).
- Build an `undo` that moves `dest` back to the original `source` and reverses the prefix rewrite
  (mirror `delete_folder`'s reverse-ordered `restore_all`). Provide a `commit` only if staging was used
  (e.g. for `overwrite`) to clean temp dirs.
- On any **runtime** failure mid-batch, restore everything already moved and return a fatal `error`
  (engine `unwind` semantics) — distinct from the skip+warn cases.

### 3.4 Register backend handler
Add to `_NODE_HANDLERS` in `execute_workflow.py`: `"move": execute_move`.

### 3.5 Frontend (mirror existing node wiring)
- `lib/types/workflow.ts`: add `'move'` to `WorkflowNodeType`, add `MoveNode` interface, add to the
  `WorkflowNode` union.
- `lib/workflow/registry/nodeCatalog.tsx`: add a `Move` entry (likely under a new or existing category;
  reuse an `react-icons/lu` icon, e.g. `LuFolderInput`/`LuArrowRightLeft`).
- `lib/workflow/validation/validateMoveConfig.ts`: require `targetPath` non-empty and a valid `allowedType`.
- `hooks/useMoveConfig.ts`: mirror `useDeleteFolderConfig` (load stored config, local state, validation, save).
- `components/nodes/move_node/`:
  - `MoveNode.tsx` (+ exported `MoveRFNode` type) — canvas node, mirror `DeleteFolderNode.tsx`.
  - `MoveConfigModal.tsx` — single-target **tree picker** (reuse the single-select `FolderPicker` /
    `ParentFolderField` pattern from `create_folder_node`, **not** the multi-select one), an
    `allowedType` selector, and an `ifExists` selector (reuse `create_folder_node/IfExistsField` +
    add the `skip` option). Reuse `ValidationMessages`, `ActionButtons`, `Modal`, `ErrorBoundary`.
- `hooks/useWorkflowEditor.ts`: register `move: MoveNode` in `NODE_TYPES`; add `MoveRFNode` to `AppNode`.
- `hooks/useWorkflowDefinition.ts`: add `buildMoveNode` factory with sensible defaults
  (`{ targetPath: '', allowedType: 'both', ifExists: 'fail' }`), wire `addGeneralNode`, and add
  `updateMoveNodeConfig`.
- `components/WorkflowEditor.tsx`: add the `MoveConfigModal` dispatch branch.

### 3.6 Tests (Stage 3)
Backend, covering each rule explicitly:
- Move files only / dirs only / both (`allowedType`).
- Fully-in-scope dir moved as a unit; its children not double-processed.
- Partially-in-scope dir (upstream `If` filtered some children) → children moved individually,
  parent untouched, `PARTIAL_DIRECTORY` warning emitted.
- `PARENT_INTO_DESCENDANT`, `TARGET_IN_SCOPE`, `NO_OP_SAME_LOCATION`, `CROSS_FILESYSTEM` each
  skip + warn and do **not** abort the rest of the batch.
- `ifExists`: `fail` (errors), `rename_incrementally`, `overwrite`, `skip` (+ `COLLISION_SKIPPED`),
  including the same-batch sibling-collision case (document `overwrite` last-wins ordering).
- Paths of moved items + descendants are rewritten; downstream node sees new paths.
- Undo restores original locations on a later fatal node error.

**Acceptance:** every edge-case rule in the table is demonstrably enforced; valid moves succeed even
when some items are skipped.

---

## Stage 4 — Copy node

**Goal:** duplicate in-scope items into 1..N target directories; optionally drop the originals.

### 4.1 Config schema
```ts
type CopyNodeConfig = {
  targetPaths: string[];              // 1..N directories, multi-select tree picker
  keepOriginal: boolean;              // default true
  allowedType: 'files' | 'directories' | 'both';
  ifExists: 'fail' | 'rename_incrementally' | 'overwrite' | 'skip';
};
```

### 4.2 Reuse the Stage-3 core
Same `allowedType` filtering, scope-faithful root computation, and pre-flight classification.
Differences from Move:
- **Cross-filesystem is allowed** (copy is inherently duplication). Do **not** emit `CROSS_FILESYSTEM`
  for Copy.
- `PARENT_INTO_DESCENDANT` still applies (copying a dir into its own descendant is invalid → skip+warn).
- Fan-out: for each valid root × each target in `targetPaths`, perform one copy.

### 4.3 Execution
- Duplicate with `shutil.copytree` (directories) / `shutil.copy2` (files); resolve destination name
  collisions via `ifExists` (reuse helpers; `overwrite` removes the conflicting target first).
- **Register produced items**: after copying a subtree, build `WorkflowItem`s for the **whole copied
  subtree** by reusing `scan_directory` on the new destination path, append them to `context.items`,
  and report their ids as `produced_ids` (they **always** join downstream scope per Stage 1).
- `keepOriginal=true` → originals remain unchanged in the tree (and continue downstream as before).
- `keepOriginal=false` → after **all** copies for a root succeed, remove the original using the
  **staging** approach from `delete_folder`/`delete_file` (move to temp; `undo` restores; `commit`
  cleans temp) and report the original ids as `removed_ids`.
- `undo`: delete the copied subtrees (and their produced items); if `keepOriginal=false`, also restore
  the staged originals. Mirror the reverse-ordered restore pattern.
- All-or-nothing rollback on runtime failure, as in Move.

### 4.4 Register & wire
- Backend `_NODE_HANDLERS`: `"copy": execute_copy`.
- Frontend: same wiring as Move (Stage 3.5) but:
  - `CopyNode` type with the config above; `'copy'` in `WorkflowNodeType` + `WorkflowNode` union.
  - `CopyConfigModal.tsx` uses the **multi-select** tree picker (reuse `MultiFolderPicker` from
    `delete_folder_node`), plus a `keepOriginal` toggle (default on), `allowedType`, and `ifExists`.
  - `useCopyConfig.ts`, `validateCopyConfig.ts` (require ≥1 `targetPaths`), catalog entry
    (icon e.g. `LuCopy`), `NODE_TYPES`/`AppNode` registration, `buildCopyNode` defaults
    (`{ targetPaths: [], keepOriginal: true, allowedType: 'both', ifExists: 'fail' }`),
    `updateCopyNodeConfig`, and the `WorkflowEditor` modal branch.

### 4.5 Tests (Stage 4)
- Copy to a single target and to multiple targets (fan-out count correct).
- `keepOriginal=true` keeps originals; `keepOriginal=false` removes them (and undo restores).
- Copied subtree items are registered (`scan_directory`) and flow downstream (always-join scope).
- Scope-faithful + all classification skips (reuse Stage-3 matrix, minus `CROSS_FILESYSTEM`, which
  must **not** fire for Copy).
- `ifExists` matrix incl. same-batch collisions.
- Undo removes copies (and restores staged originals when `keepOriginal=false`).

**Acceptance:** Copy fan-out, `keepOriginal` semantics, produced-item registration, and rollback all hold.

---

## Cross-cutting requirements

- **Security / `CLAUDE.md`:** treat all paths as untrusted. Normalize and resolve real paths
  (symlink-aware) and keep every operation inside the workflow root scope — mirror the existing
  node validation philosophy in `docs/create-folder-node-specification.md` and
  `docs/path_selection_security_summary.md`. Never move/copy outside scope.
- **Small files / functions:** keep handlers under ~200 lines; extract helpers into the shared
  transfer module; one component per frontend file; no business logic in UI components.
- **No dead code / no duplication:** Move and Copy must share the classification, root computation,
  path rewrite, and collision resolution. If you find yourself copy-pasting between `move.py` and
  `copy.py`, lift it into the shared module.
- **Error handling:** fatal errors abort + rollback; skip cases emit warnings. Never silently swallow.
- **Staging order:** do not start a stage before the previous one is green. Stages 1 and 2 are
  prerequisites for 3 and 4. After each stage: run backend tests, run frontend type-check/lint,
  and confirm no regression in the existing five nodes.

## Out of scope (explicitly not now)
- Interactive mid-run pause/confirm and a resumable execution state machine.
- Pre-run dry-run/preview gate.
- Cross-filesystem **Move**.
- Rewriting other nodes' configured paths after a relocation.

## Open question to confirm before Stage 3
- Same-batch collision: this plan folds it into the single `ifExists` field (documented order-dependence
  for `overwrite`). If the user wants a **separate** dedicated knob instead, adjust the schema and the
  config modal accordingly before implementing.
</content>
</invoke>
