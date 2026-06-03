# AI Classifier Node — Specification

## Overview

The AI Classifier Node analyzes workflow items (files and folders) using AI and assigns them to user-defined categories. It is a non-destructive node — items pass through unchanged. The classification result is stored as a **global workflow execution variable**, which can be inspected by the user and consumed by future nodes.

This document covers:
- AI Classifier Node design
- Global Workflow Execution Variables concept
- Category Library
- Variable Window (cross-node UI panel)
- Implementation impact on existing codebase
- Known challenges and open questions

---

## 1. AI Classifier Node

### Node Type

The node uses the type string `"ai_classifier"`. This is the key used in the backend `_NODE_HANDLERS` dispatch map and in the frontend workflow type system.

### Visual Design

The AI classifier node is visually distinct from standard action nodes to signal that it uses AI:

- **Border**: gradient border with a smooth color transition (e.g., blue → purple) instead of a solid border
- **Corner badge**: small AI star icon in the top-right corner
- **Node icon**: simple classification icon (e.g., tag or label stack)
- **Collection**: listed under **"AI nodes"** in the node picker, separate from file/folder action nodes

### Node Handles

- **Single input handle** — receives scoped `WorkflowItem` IDs from upstream nodes
- **Single output handle** — passes the same items through unchanged

### Behavior

The node receives a scope of `WorkflowItem` objects (same as every other node). It analyzes each item using AI and assigns it to one or more user-defined categories based on their description and criteria.

Items are **not filtered or removed** — they all pass through to downstream nodes unchanged. The only output is a variable written to the global execution context.

**Scope contract:** The node never adds or removes items from scope. Both `removed_ids` and `produced_ids` are empty. The full incoming scope is passed downstream unchanged.

### Config

```ts
{
  categories:            string[]         // ids of selected categories from the global library
  allow_duplicate:       boolean          // whether one item can appear in multiple categories; default false
  unclassified_strategy: "pass_through"   // items that match no category flow downstream silently
                       | "collect"        // unmatched items are placed in a "_unclassified" bucket in the variable
                       | "error"          // halt execution if any item cannot be classified
}
```

### Config Validation

Validation checks required fields only:

- `categories` must be non-empty (at least one category selected)
- `unclassified_strategy` must be set (one of the three valid values)
- `allow_duplicate` defaults to `false` if not explicitly set — no validation needed

### Output

Written to `context.variables[node.id]`:

```ts
{
  "Documents": [WorkflowItem, ...],
  "Images":    [WorkflowItem, ...],
  "Invoices":  [WorkflowItem, ...],
  "_unclassified": [WorkflowItem, ...]    // only present if unclassified_strategy = "collect"
}
```

The key is always the **category name** (not id), making variables human-readable when inspected in the Variable Window.

### allow_duplicate

When `true`, a single item can appear in multiple category buckets if its confidence score meets or exceeds each category's `min_confidence` threshold.

When `false`, each item is assigned to the **single category where it achieves the highest confidence score** above that category's threshold. If confidence scores are equal across multiple matching categories, the category that appears **first in the node's config order** wins. Items that match no category are handled according to `unclassified_strategy`.

### Execution Flow

1. Resolve all category IDs in config against the library — if any ID is missing, fail immediately with a clear error (see Section 2)
2. Receive scope of `WorkflowItem` objects
3. Pre-filter candidates per category using deterministic fields (`item_type`, `extensions`) — items that don't match type/extension criteria are skipped for that category without an AI call
4. For remaining candidates, send to AI with category descriptions as classification criteria — **in batches of 4 items per chunk**
5. AI returns a confidence score per `(item, category)` pair using structured output (JSON schema)
6. If a chunk fails due to token limit: fail the node with message _"Classification failed: token limit reached. Changes will be rolled back."_ and trigger workflow rollback via the existing undo mechanism
7. Apply per-category `min_confidence` threshold to decide assignment
8. Write result to `context.variables[node.id]`
9. Pass all items through unchanged

### Chunking Strategy

Items are sent to the AI in batches of **4 items per chunk**. Each chunk is an independent AI call. Results from all chunks are merged before writing to `context.variables`.

If any chunk exceeds the AI provider's token limit, execution is halted, the node returns an error, and the engine rolls back all committed changes for this run via the existing `undo_stack` mechanism. No partial classification results are written.

---

## 2. Category Library

### Overview

Categories are managed globally in a shared library, persisted in **localStorage**. All AI classifier nodes across all workflows draw from this shared library. There are two kinds of categories:

| Kind | Description |
|---|---|
| Predefined | Shipped with the app. Read-only. Can be copied into a custom category. |
| Custom | Created by the user. Editable and deletable. |

### Category Object

```ts
{
  id:             string                          // stable unique identifier
  name:           string                          // display name, used as variable key
  item_type:      "file" | "folder" | "both"
  extensions:     string[]                        // optional — soft hints, not a hard gate
  description:    string                          // core AI classification criteria
  min_confidence: "low" | "medium" | "high"
  is_predefined:  boolean                         // true = read-only, copy-only
}
```

### Confidence Level Mapping

Confidence levels are user-friendly labels that map internally to numeric thresholds:

| Level | Internal Threshold |
|---|---|
| low | 0.40 |
| medium | 0.65 |
| high | 0.85 |

These values are centralized in a constants file. They can be tuned without changing the UI or user-facing config.

### Extensions Field

Extensions are optional soft hints. They act as a **deterministic pre-filter** before the AI call — items that don't match the specified extensions skip the AI call for that category. This reduces unnecessary API calls.

Extensions are not a hard gate. If the user leaves extensions empty, all items of the matching `item_type` are sent to AI for evaluation. This is intentional:
- A category like "Legal Documents" might apply to `.pdf`, `.docx`, `.txt`, and more — forcing enumeration would be counterproductive.
- Folders have no extension, so extension-based filtering is automatically skipped for folder categories.

### Predefined Categories

Predefined categories come fully pre-configured. They are read-only but can be **copied** into a new custom category that the user can freely modify.

Suggested predefined categories (values subject to change):

| Name | item_type | Extensions | Description | min_confidence |
|---|---|---|---|---|
| Documents | file | .pdf, .doc, .docx, .txt, .odt | Looks like an official document, report, letter, or contract | medium |
| Images | file | .jpg, .jpeg, .png, .gif, .webp, .bmp, .tiff | An image or photo file | low |
| Videos | file | .mp4, .avi, .mov, .mkv, .wmv | A video recording or clip | low |
| Audio | file | .mp3, .wav, .flac, .aac, .ogg | An audio recording or music file | low |
| Archives | file | .zip, .tar, .gz, .rar, .7z | A compressed archive or bundle | low |
| Code | file | .js, .ts, .py, .java, .go, .rb, .css, .html | Source code or a programming file | medium |
| Spreadsheets | file | .xlsx, .xls, .csv, .ods | A table, spreadsheet, or structured data file | medium |
| Invoices | file | .pdf, .doc, .docx | A financial invoice, bill, or receipt | high |

### Custom Category Creation

Users create custom categories via a modal with the following fields:

- **Name** — free text, becomes the variable key in output
- **Item type** — file / folder / both (radio/select)
- **Extensions** — optional, multi-value text input (e.g. `.jpg`, `.png`)
- **Description** — free text, the AI's primary classification criteria (300 characters max)
- **Min confidence** — low / medium / high (radio/select)

The modal is accessible from inside the AI classifier node config (via an "Add category" or "Manage library" action) and saves directly to the global localStorage library.

### Orphaned Category References

If a category is deleted from the library while still referenced in a workflow node config, the reference becomes orphaned.

**At execution time:** If the node's config contains a category ID that no longer exists in the library, execution fails immediately with a clear error message identifying the missing category.

**In the config modal:** Any category in the node's selected list that cannot be resolved against the current library is shown with a warning badge. The user must remove or replace it before saving.

### Name Uniqueness and Reserved Names

Category names must be unique across the library. Uniqueness is enforced at creation time in the modal — duplicate names are rejected with an inline error.

The name `_unclassified` is reserved and cannot be used for user-created categories, as it is the system bucket name for unmatched items.

---

## 3. Global Workflow Execution Variables

### Concept

Workflow execution variables are a key-value store attached to the execution context. They accumulate as the workflow runs — each node that produces output writes to its own key.

```ts
context.variables = {
  "node-abc-123": {
    "Documents": [...],
    "Images": [...]
  },
  "node-xyz-789": {
    "Invoices": [...],
    "_unclassified": [...]
  }
}
```

The key is always the **node id**. The value is whatever that node type chooses to write — for the AI classifier it is the categorized items map.

### Infrastructure

`ExecutionContext.variables: dict[str, Any]` already exists in the backend model but is currently unused. The AI classifier node will be the first node type to populate it.

Variables are included in `WorkflowExecutionResult` and serialized in the execution status endpoint response so the frontend can read them after polling completes.

### Frontend State

The frontend retains the last execution result's variables in a `lastExecutionVariables` store entry, alongside `lastExecutionTimestamp` and `lastExecutionMode` (`"run"` or `"dryRun"`).

`lastExecutionVariables` is cleared when:
- A new execution starts (before the first poll)
- The user navigates away from the workflow

It is **not** persisted to the server — it is ephemeral, local to the current session.

## 4. Variable Window

### Overview

The Variable Window is a **reusable UI panel** that appears inside every node config modal. It shows the variables produced by previous nodes in the workflow, taken from the last execution or dry-run result.

It is read-only — no interaction, no expression editing. Its sole purpose is to help the user understand what data is available as they configure a node.

### Behavior

- If no execution has been run yet → empty state with an explanatory message
- If a run has completed → shows all variables from `lastExecutionVariables`, grouped by node
- Variables are displayed as a collapsible tree: node name → category name → list of item names/paths
- Does not filter by upstream/downstream position — shows all variables from the last run

### Dry-Run vs. Real Run

The Variable Window distinguishes the source of the last result:

- If `lastExecutionMode = "dryRun"` → show a **"DRY RUN"** badge in the panel header. The data is valid classification output but no filesystem changes were committed.
- If `lastExecutionMode = "run"` → no badge; data reflects an actual committed execution.

Both dry-run and real-run results populate `lastExecutionVariables`.

### Stale Data Warning

The panel displays a **stale indicator** when the workflow has been modified since the last execution. Staleness is determined by comparing:

- `workflowLastModifiedAt` — a timestamp updated whenever the workflow definition changes (node added, node removed, node config saved, edge added, edge removed)
- `lastExecutionTimestamp` — the timestamp of the last completed execution

If `workflowLastModifiedAt > lastExecutionTimestamp`, the panel shows a warning that results may not reflect the current configuration.

`workflowLastModifiedAt` tracking must be added to the frontend workflow state as a prerequisite to the Variable Window.

### Scope

Added to all existing node config modals as an additive UI element — no changes to existing config logic. Modals to update: `MoveConfigModal`, `CopyConfigModal`, `SwitchConfigModal`, and any others with a config panel.

### Implementation Notes

- Implemented as a standalone reusable component (`WorkflowVariablesPanel`)
- Reads from shared frontend state: `lastExecutionVariables`, `lastExecutionTimestamp`, `lastExecutionMode`, `workflowLastModifiedAt`
- Does not require graph traversal — shows all variables regardless of node position

---

## 5. Node Config Modal Structure

The AI classifier node config modal consists of:

1. **Categories section** — list of selected categories with ability to reorder, remove, or edit. "Add from library" picker and "Create new" shortcut. Categories missing from the library are shown with a warning badge.
2. **allow_duplicate toggle**
3. **Unclassified strategy selector** — pass through / collect / error
4. **Variable Window panel** — showing last run variables (shared across all nodes)

---

## 6. Implementation Impact

This section lists codebase changes required outside the new node itself.

### Backend

**`WorkflowExecutionResult` model** — add `variables: dict[str, Any]` field. This is serialized in the execution store status endpoint response so the frontend reads it after polling completes.

**`_NODE_HANDLERS` dispatch map** — add `"ai_classifier": execute_ai_classifier` entry in `execute_workflow.py`.

**AI classifier handler** — lives in `workflows/application/nodes/ai_classifier.py`, consistent with all other node handlers. AI provider communication is isolated in the `ai/` module and called from the handler. The handler returns `(error, None, None)` — no undo/commit callbacks since the node performs no filesystem operations.

**Config remapping** — the AI classifier config contains no path fields. No changes needed to `_SINGLE_PATH_FIELDS` / `_LIST_PATH_FIELDS` in `transfer_helpers.py`.

**Confidence constants** — define `CONFIDENCE_THRESHOLDS: dict[str, float]` in a shared constants file. Referenced by the handler and tests.

### Frontend

**`useWorkflowExecution` hook** — persist `variables` from the completed execution result into `lastExecutionVariables` store. Clear `lastExecutionVariables` when a new execution starts.

**`lastExecutionVariables` store** — new shared state entry alongside `lastExecutionTimestamp` and `lastExecutionMode`.

**`workflowLastModifiedAt` tracking** — update this timestamp in the workflow state on every structural change (node add/remove/reconfigure, edge add/remove). Required for stale detection. Frontend-only, not sent to the backend.

**`WorkflowVariablesPanel` component** — new reusable panel. Added to all existing node config modals.

**Node registry** — register `"ai_classifier"` node type with its canvas component, config modal, validation function, and collection (`"AI nodes"`).

---

## 7. Challenges and Obstacles

### 7.1 AI Call Design

Decisions made:

- **Batching**: Items are sent in **batches of 4 per chunk**. Each chunk is an independent AI call.
- **Structured output**: The AI returns a list of `{ item_id, category_id, confidence }` tuples using JSON schema. Free-form response parsing is not used.
- **Token limits**: If a chunk exceeds the provider's token limit, execution fails with a user-facing message and triggers workflow rollback. No partial results are written.
- **Item representation**: Each item is represented by its name, extension, mime_type, size, and item_type. File content analysis is out of scope.

### 7.2 Confidence Score Reliability

AI models don't always produce well-calibrated confidence scores. A score of 0.85 from one model may not mean the same as 0.85 from another. The low/medium/high abstraction partially mitigates this, but threshold values may need per-model tuning. Thresholds are centralized in a constants file to make tuning straightforward.

### 7.3 Category Name Collisions

Enforced at creation time via modal validation. The reserved name `_unclassified` is blocked. Duplicate names across the library are rejected with an inline error.

### 7.4 allow_duplicate = false — Tie-Breaking

When `allow_duplicate = false`, each item goes to the single category with the highest confidence score above threshold. Equal confidence scores are broken by category order in the node config. This behavior is communicated to the user in the UI (e.g., a hint below the categories list or a tooltip on the toggle).

### 7.5 Dry-Run Behavior

In dry-run mode, the AI classifier still executes the AI call and populates `context.variables` — the user needs to see classification results to understand what would happen downstream. Unlike filesystem nodes, there is no disk operation to skip. This means dry-run does not reduce cost for the classifier node.

The dry-run result is stored in `lastExecutionVariables` with `lastExecutionMode = "dryRun"` so the Variable Window can display it with a "DRY RUN" badge.

### 7.6 Frontend Variable State Management

`lastExecutionVariables` is cleared when a new execution starts and when the user leaves the workflow. Stale detection requires `workflowLastModifiedAt` on the workflow definition, updated on every structural change. This is a frontend-only timestamp, not sent to the backend.

### 7.7 Large Category Libraries

If users accumulate many custom categories over time, the picker UI needs search/filter. Not a concern for the MVP but worth designing the picker with filtering in mind from the start.

### 7.8 Item Type = "folder" Classification

Classifying folders is based on name, path, and metadata only — folder content is not analyzed. This should be clearly communicated in the UI, as users may expect AI to look inside folders.

### 7.9 LocalStorage Size Limits

The category library is persisted in localStorage. If users create many categories with long descriptions, they may approach the ~5MB browser localStorage limit. For the MVP this is not a concern. IndexedDB would be a more robust alternative for the future.

---

## 8. Out of Scope (Initial Implementation)

- Referencing variables in downstream node configs (expression syntax)
- File content analysis (reading file contents for classification)
- Category library sync across devices or users
- Per-run classification history / audit log
- AI provider selection (assume a single configured provider)
- Streaming / progressive classification results in the UI
- Variable payload size optimization (large directory handling in the API response)
- Privacy/path anonymization when sending item metadata to the AI provider
