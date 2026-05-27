# IF Node — Technical Design & Implementation Specification

## Purpose

The `If Node` is a core workflow control-flow node responsible for conditional branching.

The node evaluates conditions against incoming workflow items and routes them into one of two execution paths:

- `true`
- `false`

The node belongs to the `general` category.

---

# Core Principles

The `If Node` is designed as:

- a pure evaluation node
- deterministic
- side-effect free
- metadata-driven
- serialization-friendly
- workflow-safe

The node MUST NOT:

- scan the filesystem again
- perform filesystem discovery
- mutate files
- invoke AI models
- execute arbitrary scripts

The node ONLY evaluates existing workflow item metadata.

---

# Workflow Architecture Context

## Important System Assumption

The entire workflow engine operates on a pre-built tree structure.

This means the workflow receives:

```ts
WorkflowTree
```

containing already discovered:

- files
- folders
- metadata
- hierarchy relationships

The workflow engine DOES NOT continuously search the filesystem again.

Instead, all nodes operate within the already defined tree structure.

---

# Example

## Initial Discovery Phase

```txt
Input Paths
    ↓
Tree Builder
    ↓
WorkflowTree
    ↓
Workflow Execution
```

---

# Example Tree Structure

```ts
type WorkflowItem = {
  id: string

  path: string
  name: string

  type: "file" | "folder" | "symlink"

  extension?: string
  mimeType?: string

  stat: {
    size: number
    createdAt: string
    modifiedAt: string
    accessedAt: string
  }

  flags: {
    hidden: boolean
    executable: boolean
    readable: boolean
    writable: boolean
  }

  children?: WorkflowItem[]

  ai?: Record<string, unknown>

  workflow?: {
    evaluation?: unknown
  }
}
```

---

# Node Definition

```ts
type IfNode = {
  id: string

  type: "if"

  category: "general"

  config: {
    conditions: ConditionGroup
  }

  outputs: {
    true: string
    false: string
  }
}
```

---

# Execution Model

## Input

The node receives:

```ts
WorkflowItem[]
```

NOT a single item.

---

# Routing Strategy

The node evaluates each item independently.

Matching items are routed to:

```txt
true output
```

Non-matching items are routed to:

```txt
false output
```

---

# Example

## Input

```txt
[
  photo.jpg,
  invoice.pdf,
  archive.zip
]
```

## Condition

```txt
extension == ".jpg"
```

## Output

### True Path

```txt
[
  photo.jpg
]
```

### False Path

```txt
[
  invoice.pdf,
  archive.zip
]
```

---

# Condition Architecture

The node uses nested condition groups.

This enables:

- AND logic
- OR logic
- nested evaluation
- logical negation

---

# Condition Tree Structure

```txt
GROUP
 ├── condition
 ├── condition
 ├── subgroup
```

---

# Example Logic

```txt
(
   extension == ".png"
   AND
   size > 5MB
)
OR
(
   modifiedWithinLast(7d)
)
```

---

# Logical Operators

Supported operators:

```ts
type LogicalOperator =
  | "AND"
  | "OR"
```

---

# Negation Support

Both conditions and groups support negation.

---

# Example

```txt
NOT (
   extension == ".tmp"
)
```

---

# Maximum Nesting Depth

To protect:

- UI complexity
- evaluator stability
- recursion safety

the system applies:

```ts
MAX_GROUP_DEPTH = 10
```

---

# Condition DSL

## Condition Group

```ts
type ConditionGroup = {
  id: string

  operator: "AND" | "OR"

  negate?: boolean

  children: Array<
    Condition |
    ConditionGroup
  >
}
```

---

# Condition

```ts
type Condition = {
  id: string

  field: string

  operator: string

  value: unknown

  negate?: boolean

  options?: {
    caseSensitive?: boolean
  }
}
```

---

# Example JSON

```json
{
  "operator": "AND",
  "children": [
    {
      "field": "type",
      "operator": "equals",
      "value": "file"
    },
    {
      "operator": "OR",
      "children": [
        {
          "field": "size",
          "operator": "greater_than",
          "value": 5242880
        },
        {
          "field": "extension",
          "operator": "equals",
          "value": ".png"
        }
      ]
    }
  ]
}
```

---

# Supported Conditions

# 1. Item Type

```ts
type
```

Supported values:

- file
- folder
- symlink

---

# 2. Name

```ts
name
```

Operators:

- equals
- contains
- starts_with
- ends_with

---

# 3. Extension

```ts
extension
```

Examples:

```txt
extension == ".jpg"
extension == ".pdf"
```

---

# 4. Size

```ts
size
```

Operators:

- >
- <
- >=
- <=
- between

Internally:

```ts
number
```

stored in bytes.

---

# 5. Created Date

```ts
created_at
```

---

# 6. Modified Date

```ts
modified_at
```

---

# 7. Accessed Date

```ts
accessed_at
```

Operators:

- before
- after
- between
- within_last

Dates operate in local timezone.

---

# 8. Hidden Flag

```ts
is_hidden
```

---

# 9. Executable Flag

```ts
is_executable
```

---

# 10. Readable Flag

```ts
is_readable
```

---

# 11. Writable Flag

```ts
is_writable
```

---

# 12. MIME Type

```ts
mime_type
```

Examples:

```txt
mime_type starts_with "image/"
```

---

# 13. Path

```ts
path
```

Examples:

```txt
path contains "/archive/"
```

---

# 14. Folder Recursive Size

For folders:

```ts
size
```

represents recursive folder size.

---

# 15. Empty Folder

```ts
is_empty
```

Definition:

```txt
Folder contains no files or folders recursively.
```

---

# 16. Children Count

```ts
children_count
```

---

# 17. Tree Depth

```ts
depth
```

---

# 18. AI Metadata

AI conditions are supported through previously enriched metadata.

The `If Node` NEVER invokes AI models directly.

---

# AI Architecture

Recommended workflow:

```txt
Scan Folder
    ↓
AI Analyze Node
    ↓
If Node
```

---

# Example AI Metadata

```ts
{
  ai: {
    category: "invoice",
    language: "en",
    containsFaces: false,
    confidence: 0.91
  }
}
```

---

# Example AI Conditions

```txt
ai.category == "invoice"
```

```txt
ai.language == "pl"
```

```txt
ai.containsFaces == true
```

---

# Why AI Is External

AI execution is intentionally separated from conditional evaluation.

This provides:

- deterministic execution
- caching support
- explainability
- better debugging
- predictable costs
- separation of concerns

---

# Unsupported Features

The following are intentionally NOT supported in MVP:

- regex
- scripting
- inline JavaScript
- custom variables
- inline AI execution
- dynamic expressions

---

# Strongly Typed Values

All values are normalized internally.

Example:

```json
{
  "value": 5242880
}
```

NOT:

```json
{
  "value": "5MB"
}
```

UI layers are responsible for parsing user-friendly formats.

---

# Evaluation Strategy

The evaluator uses classic short-circuit logic.

---

# AND Example

```txt
false AND ...
```

Stops immediately.

---

# OR Example

```txt
true OR ...
```

Stops immediately.

---

# Missing Metadata Handling

Missing fields are configurable.

Supported strategies:

```ts
type MissingFieldStrategy =
  | "false"
  | "error"
  | "skip"
```

Recommended default:

```txt
false
```

---

# Case Sensitivity

String conditions support configurable case sensitivity.

Example:

```ts
{
  operator: "contains",
  value: "invoice",

  options: {
    caseSensitive: false
  }
}
```

---

# Unknown Fields

If a field no longer exists:

- evaluator produces warning
- condition evaluates to false

This prevents hard workflow crashes.

---

# Async Evaluation

The evaluator MAY operate asynchronously.

This enables future support for:

- advanced metadata providers
- lazy metadata loading
- async enrichment systems

---

# Evaluator Interface

```ts
async function evaluate(
  item: WorkflowItem,
  group: ConditionGroup
): Promise<boolean>
```

---

# Enriched Output Payload

The node enriches items with evaluation metadata.

---

# Example

```ts
{
  path: "/files/invoice.pdf",

  workflow: {
    evaluation: {
      matched: true,

      matchedConditions: [
        "extension == .pdf",
        "size > 1MB"
      ]
    }
  }
}
```

---

# Why Enrichment Matters

This enables:

- debugging
- explainability
- analytics
- audit trails
- downstream processing

---

# Explainability & Debugging

The evaluator should expose debugging information.

---

# Example

```txt
Condition failed:
size > 5MB

Actual:
1.2MB
```

---

# Validation Rules

The node is invalid when:

- no conditions exist
- nesting depth exceeds limit
- malformed conditions detected

---

# Minimal UI Requirements

The UI should provide:

- visual condition builder
- AND / OR grouping
- nested groups
- negation toggle
- operator selector
- field selector
- typed value input

The UI SHOULD NOT expose raw JSON by default.

---

# Example Workflow

## Invoice Processing

```txt
Scan Folder
    ↓
Analyze Document
    ↓
If ai.category == "invoice"
    ↓
Move To Accounting
```

---

# Example Workflow

## Media Cleanup

```txt
Scan Folder
    ↓
If (
    extension == ".tmp"
    OR
    size == 0
)
    ↓
Delete File
```

---

# Example Workflow

## Image Organization

```txt
Scan Folder
    ↓
AI Analyze Image
    ↓
If (
    ai.containsFaces == true
    AND
    size > 2MB
)
    ↓
Move To Photos
```

---

# Architectural Summary

The `If Node` is designed as:

- a deterministic evaluator
- a routing node
- metadata-driven
- async-compatible
- serialization-friendly
- AI-compatible through enrichment
- workflow-safe
- explainable
- strongly typed

It is NOT:

- a scripting engine
- an AI execution node
- a filesystem scanner
- a mutation node
