# Create Folder Node — Frontend Architecture Specification

## Overview

The `Create Folder` node is the first workflow node responsible for mutating the filesystem structure.
Its purpose is to create a new folder inside an already existing parent folder that belongs to the workflow runtime scope.

This document describes:

* node structure,
* configuration schema,
* runtime behavior,
* validation rules,
* execution logic,
* workflow integration,
* output contracts,
* runtime tree synchronization,
* architectural assumptions.

This document intentionally excludes UX/UI concerns and focuses purely on technical implementation and workflow architecture.

---

# High-Level Responsibilities

The node is responsible for:

1. Creating a new folder inside a selected existing parent folder.
2. Validating configuration correctness.
3. Handling folder conflict resolution.
4. Updating workflow runtime state.
5. Returning a valid runtime resource for downstream nodes.
6. Maintaining deterministic workflow behavior.

---

# Node Definition

## Node Metadata

```ts
type CreateFolderNodeDefinition = {
  type: "createFolder";
  category: "create";

  inputs: 1;
  outputs: 1;
};
```

---

# Architectural Assumptions

## Workflow Operates on Runtime Tree

The workflow engine operates on a synchronized runtime representation of the filesystem.

The system should NOT operate directly on arbitrary filesystem string paths.

Instead:

* workflow nodes operate on `WorkflowItem` references,
* the runtime tree is treated as the source of workflow execution state,
* filesystem mutations synchronize with runtime state updates.

This is a foundational architectural assumption.

---

# Runtime Tree Philosophy

The workflow engine should behave more like:

* a resource graph,
* scene graph,
* AST-like mutable execution graph,

than a traditional shell script executor.

This enables:

* deterministic execution,
* stable references,
* easier branching,
* easier filtering,
* execution tracing,
* virtual execution,
* future undo/history support,
* safer scope validation.

---

# Node Configuration

## Configuration Structure

```ts
type CreateFolderNodeConfig = {
  folderName: string;

  parentFolderId: string;

  ifExists:
    | "reuse_existing"
    | "rename_incrementally"
    | "overwrite"
    | "fail";
};
```

---

# Configuration Fields

## folderName

The name of the folder to create.

This value represents only the folder name, not the full path.

Example:

```txt
Invoices_2026
```

---

## parentFolderId

Reference to an existing runtime folder item.

This should reference an already existing `WorkflowItem`.

The node MUST NOT accept arbitrary filesystem paths.

The selected parent folder:

* must exist,
* must belong to runtime scope,
* must be present in runtime tree,
* must be a directory.

---

## ifExists

Determines how the node behaves if the target folder already exists.

---

# Conflict Resolution Strategies

## reuse_existing

Behavior:

* if folder already exists:

  * reuse existing folder,
  * do not modify contents,
  * do not recreate folder,
  * execution succeeds.

Result:

```ts
{
  status: "success",
  action: "reused"
}
```

This should be considered the default and recommended behavior.

---

## rename_incrementally

Behavior:

If target folder exists:

```txt
Invoices
Invoices (1)
Invoices (2)
```

The node creates the first available unique folder name.

Execution succeeds.

---

## overwrite

Behavior:

* remove existing folder recursively,
* create new empty folder,
* execution succeeds.

This is a destructive operation.

The node should internally treat this as:

```txt
delete → recreate
```

not as a mutation of the existing folder.

---

## fail

Behavior:

* node execution fails,
* no filesystem mutation occurs,
* no runtime state changes occur.

---

# Explicitly Rejected Behavior

## Missing Parent Auto-Creation

The node MUST NOT create missing parent directories.

This means:

```txt
mkdir -p
```

behavior is explicitly forbidden.

Reasoning:

* parent folder must already exist,
* parent folder must already belong to runtime tree,
* workflow must operate on known resources only,
* hidden implicit mutations must be avoided.

This keeps execution deterministic and debuggable.

---

# Runtime Input

## Input Contract

The workflow execution engine provides access to runtime state.

Example conceptual structure:

```ts
type WorkflowRuntime = {
  items: WorkflowItem[];
};
```

---

# WorkflowItem Structure

Recommended structure:

```ts
type WorkflowItem = {
  id: string;

  type: "file" | "folder";

  name: string;

  path: string;

  absolutePath: string;

  parentId?: string;

  createdByNodeId?: string;

  metadata?: {
    createdAt?: number;
    modifiedAt?: number;
    size?: number;
  };
};
```

---

# Node Execution Flow

# Step 1 — Resolve Parent Folder

The node resolves:

```ts
parentFolderId
```

against runtime state.

Requirements:

* item must exist,
* item must be folder,
* item must be accessible,
* item must belong to current workflow scope.

If not:

```ts
execution = failed
```

---

# Step 2 — Validate Folder Name

The node validates:

```ts
folderName
```

Validation rules are described later in this document.

---

# Step 3 — Build Target Path

The node constructs:

```txt
parentPath + folderName
```

Example:

```txt
/Documents/Clients + Invoices
```

↓

```txt
/Documents/Clients/Invoices
```

---

# Step 4 — Check Existing Folder

The node checks whether target folder already exists.

Possible outcomes depend on:

```ts
ifExists
```

strategy.

---

# Step 5 — Execute Strategy Logic

## reuse_existing

If folder exists:

* do not modify filesystem,
* reuse existing folder,
* return success result.

---

## rename_incrementally

Find first available folder name.

Example:

```txt
Invoices
Invoices (1)
Invoices (2)
```

Create resolved folder.

---

## overwrite

If folder exists:

1. remove recursively,
2. create empty folder,
3. update runtime state.

---

## fail

If folder exists:

* terminate node execution with error.

---

# Step 6 — Create Runtime Item

After successful execution:

* create new `WorkflowItem`,
* insert it into runtime state,
* make it available for downstream nodes.

This step is mandatory.

---

# Runtime State Synchronization

## Critical Architectural Requirement

Filesystem mutations MUST synchronize with runtime tree updates.

The newly created folder must immediately become available to subsequent workflow nodes.

Example:

```txt
Create Folder
    ↓
Move Files
    ↓
AI Categorization
```

The downstream nodes must receive access to the newly created folder through runtime state.

---

# Output Contract

The node should NOT return only a string path.

It should return a complete runtime resource object.

---

# Recommended Output Structure

```ts
type CreateFolderNodeOutput = {
  folder: WorkflowItem;
};
```

---

# Execution Result Structure

Recommended execution result:

```ts
type CreateFolderExecutionResult = {
  status:
    | "success"
    | "failed";

  action:
    | "created"
    | "reused"
    | "overwritten"
    | "renamed";

  folder?: WorkflowItem;

  message?: string;

  warnings?: string[];
};
```

---

# Important Semantic Distinction

## success != created

Examples:

Folder newly created:

```ts
{
  status: "success",
  action: "created"
}
```

Folder already existed and reused:

```ts
{
  status: "success",
  action: "reused"
}
```

This distinction is important for:

* execution tracing,
* debugging,
* logging,
* future audit systems.

---

# Validation Rules

# Frontend Validation

Frontend validation exists to:

* improve UX,
* reduce invalid executions,
* reduce runtime failures.

Frontend validation MUST NOT be treated as security validation.

Backend validation remains mandatory.

---

# Required Fields

All configuration fields are mandatory.

---

# Folder Name Validation

## Length Limit

```txt
1-30 characters
```

This limit should exist both:

* in validation,
* and at input constraint level.

---

## Forbidden Characters

The following characters must be rejected:

```txt
< > : " / \ | ? *
```

---

## Forbidden Relative Tokens

The following values must be rejected:

```txt
..
.
~/
```

---

## Trailing Characters

Reject:

* trailing spaces,
* trailing dots.

Example invalid names:

```txt
Invoices.
Invoices 
```

---

## Reserved Windows Names

The following names must be rejected:

```txt
CON
PRN
AUX
NUL
COM1
COM2
COM3
LPT1
LPT2
```

etc.

Validation should be case-insensitive.

---

# Parent Folder Validation

The selected parent folder:

* must exist in runtime tree,
* must be a folder,
* must belong to workflow scope.

---

# Backend Validation

Backend validation is mandatory regardless of frontend validation.

---

# Required Backend Checks

## Parent Exists

Validate filesystem existence.

---

## Parent Is Directory

Ensure parent path is a folder.

---

## Scope Validation

All operations must remain inside allowed workflow scope.

The system must prevent path escaping.

---

## Path Normalization

The backend should normalize and resolve paths before validation.

---

## Symlink Protection

The backend should validate resolved real paths, not only string paths.

Reason:

A valid-looking path may point outside workflow scope through symlinks.

---

# Runtime Validation vs Config Validation

Validation must happen:

1. during configuration,
2. during execution.

Reason:

Filesystem state may change between:

* workflow creation,
* workflow execution.

Examples:

* folder deleted,
* permissions changed,
* symlink modified,
* external drive disconnected.

---

# Deterministic Execution Philosophy

The node should behave deterministically.

This means:

* no hidden parent creation,
* no implicit scope expansion,
* no arbitrary filesystem traversal,
* no uncontrolled mutations.

The node should mutate only:

```txt
one known child folder inside one known parent folder
```

---

# Recommended Internal Mental Model

The node should be treated internally as:

```txt
Ensure child folder exists inside known runtime parent
```

not:

```txt
Create arbitrary filesystem path
```

This distinction is foundational for future scalability of the workflow engine.

---

# Future-Proofing Considerations

This section does not define current implementation requirements but explains future architectural compatibility.

---

# Stable Runtime References

The workflow system should prefer:

```ts
parentFolderId
```

instead of raw path references.

Reason:

* move operations remain stable,
* rename operations remain stable,
* workflow graph remains consistent.

---

# Runtime Graph Synchronization

Future nodes may depend heavily on:

* runtime references,
* resource relationships,
* graph mutations.

This architecture simplifies:

* branching,
* filtering,
* AI enrichment,
* previews,
* dry runs,
* execution history.

---

# Dry Run Compatibility

The node architecture should allow future support for:

```txt
simulation mode
```

where:

* no filesystem mutations occur,
* runtime changes are virtual only,
* outputs are simulated.

---

# Final Architectural Principle

The Create Folder node is not merely a filesystem utility.

It is a runtime graph mutation node.

Its primary responsibility is:

```txt
creating and registering a new runtime resource
```

inside the workflow execution graph.
