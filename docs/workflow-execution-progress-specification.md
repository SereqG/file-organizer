# Workflow Execution Progress & Logging

## Overview

During a workflow run, users currently see nothing but a spinning icon in the Run button. This document specifies the full progress feedback system: live node tracking, a structured log panel, and UI locking during execution.

---

## Goals

- Show which node is currently executing on the canvas
- Let the user review per-item logs grouped by node in a side panel
- Lock all editing during execution to prevent confusion
- Not interrupt the user — the log panel is opt-in

---

## Scope

### What Changes

| Area | Change |
|------|--------|
| `ExecutionContext` | Add `log_entries`, `start_time`, `on_node_start` hook |
| `ExecutionState` | Add `current_node_id` |
| `execute_workflow.py` | Call `on_node_start` hook before each node |
| `execute_resumable.py` | Wire `on_node_start` hook to update `current_node_id` |
| Node handlers | Append `LogEntry` to `context.log_entries` per processed item |
| Polling endpoint | Return `currentNodeId` and `logEntries` |
| `useWorkflowExecution` | Consume `currentNodeId` and `logEntries` from poll |
| Node renderer | Show spinner overlay when node is active |
| `LogsPanelButton` | Right-edge tab with pulse animation |
| `LogsPanel` | Right-side overlay with collapsible node sections |
| Config modals | All fields disabled while `isRunning` |

---

## Backend

### `LogEntry` Model

Add to `app/modules/workflows/domain/models.py`:

```python
@dataclass
class LogEntry:
    node_id: str
    node_name: str       # user-visible label from WorkflowNode.name
    kind: str            # see Kind Values below
    item_name: str       # basename only — no full paths, no destination
    message: str | None  # populated for "skipped" and "warning" only
    elapsed: float       # seconds since context.start_time
```

**Kind values:** `moved`, `copied`, `created`, `deleted`, `renamed`, `skipped`, `warning`

---

### `ExecutionContext` Additions

```python
start_time: float = field(default_factory=time.time)
log_entries: list[LogEntry] = field(default_factory=list)
on_node_start: Optional[Callable[[str, str], None]] = None  # (node_id, node_name)
```

`start_time` is set at context creation. `on_node_start` follows the same optional-hook pattern as `request_decision` — the engine calls it if set, does nothing if not.

---

### `ExecutionState` Addition

```python
current_node_id: Optional[str] = None
```

Written from the worker thread; must be updated under `state.lock`.

---

### `execute_workflow.py`

Before dispatching each node (including routing nodes — if, switch, ai_classifier), call:

```python
if context.on_node_start:
    context.on_node_start(node_id, node.name)
```

This applies to every node type so the spinner tracks routing nodes too.

---

### `execute_resumable.py`

Wire the hook when starting the background worker:

```python
def _set_current_node(state: ExecutionState, node_id: str) -> None:
    with state.lock:
        state.current_node_id = node_id
        state.updated_at = time.time()

# Inside blocking():
state.context.on_node_start = lambda node_id, name: _set_current_node(state, node_id)
```

On completion set `state.current_node_id = None` in `finish()` and `fail()`.

---

### Node Handlers

Each handler already processes items one by one. For each item, append a `LogEntry` to `context.log_entries` in addition to existing behavior (`context.warnings`, `context.actions`).

Log entries are append-only. Existing warnings still go to `context.warnings` — log entries are additive, not a replacement.

**Examples:**

`move.py` — successful move:
```python
context.log_entries.append(LogEntry(
    node_id=node.id,
    node_name=node.name,
    kind="moved",
    item_name=Path(root).name,
    message=None,
    elapsed=time.time() - context.start_time,
))
```

`move.py` — collision skipped:
```python
context.log_entries.append(LogEntry(
    node_id=node.id,
    node_name=node.name,
    kind="skipped",
    item_name=Path(root).name,
    message="name already exists",
    elapsed=time.time() - context.start_time,
))
```

Apply the same pattern to `copy.py`, `rename_file.py`, `rename_folder.py`, `delete_file.py`, `delete_folder.py`, `create_folder.py`.

---

### Polling Endpoint — `_serialize_state`

Add to the payload:

```python
"currentNodeId": state.current_node_id,
"logEntries": [
    {
        "nodeId": e.node_id,
        "nodeName": e.node_name,
        "kind": e.kind,
        "itemName": e.item_name,
        "message": e.message,
        "elapsed": round(e.elapsed, 3),
    }
    for e in state.context.log_entries
],
```

The full list is returned on every poll. The frontend replaces its local copy — no diffing or cursor needed.

---

## Frontend

### Type Additions (`lib/types/workflow.ts`)

```typescript
export interface LogEntry {
  nodeId: string;
  nodeName: string;
  kind: 'moved' | 'copied' | 'created' | 'deleted' | 'renamed' | 'skipped' | 'warning';
  itemName: string;
  message: string | null;
  elapsed: number; // seconds
}
```

---

### `useWorkflowExecution` Changes

Add to `ExecutionState`:

```typescript
currentNodeId: string | null;
logEntries: LogEntry[];
```

Populate from poll response:

```typescript
case 'awaiting_input':
  setState((s) => ({
    ...s,
    pendingDecision: data.pendingDecision ?? null,
    currentNodeId: data.currentNodeId ?? null,
    logEntries: data.logEntries ?? s.logEntries,
  }))
  return
default:
  setState((s) => ({
    ...s,
    pendingDecision: null,
    currentNodeId: data.currentNodeId ?? null,
    logEntries: data.logEntries ?? s.logEntries,
  }))
  scheduleNext()
```

On `finish()`, clear `currentNodeId` (keep `logEntries` so the panel stays readable after run):

```typescript
setState({ isRunning: false, pendingDecision: null, currentNodeId: null, result: ..., logEntries: s.logEntries })
```

Expose `currentNodeId` and `logEntries` in the hook's return value.

---

### Node Spinner

The node renderer receives `isActive: boolean`. When true, render a small spinning overlay in the top-right corner of the node card.

```tsx
{isActive && (
  <div className="absolute top-1.5 right-1.5">
    <LuLoaderCircle size={12} className="animate-spin text-white/60" />
  </div>
)}
```

`currentNodeId` flows from `RuntimeControls` → `WorkflowEditor` → individual node components.

---

### UI Lock During Execution

All node config modal fields get `disabled={isRunning}`. Modals can still be opened — the user can inspect config — but no input is accepted. The same `isRunning` flag that already disables the Run button drives this. Thread it down through the editor props into config panels.

---

### `LogsPanelButton`

A vertical tab anchored to the right edge, vertically centered:

- **Appears** when a run starts (`isRunning` becomes true)
- **Disappears** when the user clears the result (same lifecycle as `ExecutionResultPopup`)
- **Pulse animation** while `isRunning && !panelOpen` — stops once the user opens the panel or the run ends
- Clicking it toggles the `LogsPanel` open/closed

Placement: `fixed right-0 top-1/2 -translate-y-1/2`, rotated label or icon tab.

```tsx
<button
  onClick={togglePanel}
  className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5
    rounded-l-lg border border-r-0 border-white/10 bg-[#111] px-2 py-3
    text-xs font-medium text-white/60 hover:text-white/90 transition-colors
    ${isRunning && !panelOpen ? 'animate-pulse' : ''}`}
>
  <LuScrollText size={14} />
</button>
```

---

### `LogsPanel`

Overlay sliding in from the right. Does not push the canvas.

```
fixed right-0 top-0 h-full w-80 z-40
border-l border-white/10 bg-[#0c0c0c]/95 backdrop-blur
flex flex-col
```

**Header:**
- "Execution Logs" label
- Close button (X)

**Body:**
- Scrollable (`overflow-y-auto flex-1`)
- Auto-scrolls to bottom while `isRunning` (stop auto-scroll if user scrolls up)
- One `NodeLogSection` per unique `nodeId` in `logEntries`, in order of first appearance

**Empty state:**
```
"Logs will appear as the workflow runs."
```

---

### `NodeLogSection`

Collapsible section per node:

```
▾  Move to Archive  ·  12         ← header, click to collapse
   +0.12s  MOVED    report.pdf
   +0.13s  SKIPPED  notes.txt — name already exists
```

- **Expanded by default** when the node is active (`nodeId === currentNodeId`)
- User can collapse any section manually; that state is local (not persisted)
- Entry count shown next to node name, updates live

---

### Log Row

```
+0.12s   [MOVED]   report.pdf
+0.13s   [SKIPPED] notes.txt — name already exists     ← amber
```

**Elapsed format:** `+{seconds}s` rounded to 2 decimal places (e.g. `+0.12s`, `+3.40s`)

**Kind badge colors** (match dry-run preview palette):
| Kind | Color |
|------|-------|
| moved | violet |
| copied | amber |
| created | emerald |
| deleted | red |
| renamed | sky |
| skipped | amber (with message) |
| warning | amber (with message) |

---

## Implementation Stages

Each stage is independently shippable and testable:

### Stage 1 — Backend log accumulation
- Add `LogEntry` model
- Add `log_entries` and `start_time` to `ExecutionContext`
- Node handlers append log entries during real execution
- Polling endpoint returns `logEntries`
- Verify in API response before touching frontend

### Stage 2 — Backend current node streaming
- Add `current_node_id` to `ExecutionState`
- Add `on_node_start` hook to `ExecutionContext`
- Wire hook in `execute_resumable.py`
- Call hook in `execute_workflow.py` before each node
- Polling endpoint returns `currentNodeId`

### Stage 3 — Frontend data layer
- Add `LogEntry` type
- Update `useWorkflowExecution` to consume `currentNodeId` and `logEntries`

### Stage 4 — Node spinner
- Pass `currentNodeId` down to node renderer
- Render spinner overlay on active node

### Stage 5 — Log panel
- `LogsPanelButton` (right-edge tab, pulse animation)
- `LogsPanel` (overlay, auto-scroll)
- `NodeLogSection` (collapsible)
- Log row component

### Stage 6 — UI lock
- Disable all config panel fields while `isRunning`

---

## What the User Sees (End State)

| Phase | Visible |
|-------|---------|
| Run clicked | Dry-run preview modal (unchanged) |
| Confirmed | Spinner in Run button; pulsing tab appears on right edge |
| Executing | Spinner on currently-active node in canvas; tab pulses |
| User opens panel | Log panel slides over canvas; tab stops pulsing; logs stream in |
| Collision | Decision modal (unchanged); log panel stays open behind it |
| Completed | Spinner gone; result popup appears; log panel stays open |
| User closes result | Result popup gone; log panel and tab remain until user dismisses |
