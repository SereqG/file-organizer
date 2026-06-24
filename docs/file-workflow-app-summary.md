# File Workflow Automation App – Architecture & Security Summary

## Project Goal

Build a web application that allows users to create and execute file-management workflows, such as:

- Creating folders
- Moving files
- Renaming files
- Organizing files based on rules

### Demo Strategy

Instead of manipulating a user's real filesystem, provide a sandboxed demo environment containing realistic sample files and folders.

Example:

```text
Downloads/
├── invoice_2026.pdf
├── cat.jpg
├── tax_report.pdf

Documents/
Photos/
Invoices/
```

This allows users to experiment safely without risking their own files.

---

# Filesystem Access Reality

## Current State

The application manipulates files on the host machine where it is running.

```text
User Browser
      ↓
 Web Application
      ↓
 Server Filesystem
```

The user is not modifying their own computer.

---

## Can a Web App Manipulate User Files?

Generally: **No**.

Browsers intentionally prevent arbitrary filesystem access.

A web application cannot:

- Browse the entire disk
- Delete arbitrary files
- Access folders without permission

### Browser Exception

Modern browsers support the File System Access API.

The user explicitly grants access to a chosen folder:

```javascript
const dirHandle = await window.showDirectoryPicker();
```

The application can then operate only within that selected location.

---

## Future Self-Hosting Vision

A strong future direction is:

```text
Workflow Engine
       ↓
 Host Filesystem
```

Users deploy the application on their own machine or server and allow workflows to operate on real files.

This is often easier and safer than trying to access a remote user's machine from a hosted SaaS application.

---

# Recommended Demo Architecture (Minimal Version)

```text
Browser
   ↓
Frontend
   ↓
Backend API
   ↓
Workflow Engine
   ↓
Sandbox Directories
   ↓
SQLite
```

## Components

### Frontend

Responsibilities:

- Workflow editor
- File tree viewer
- Execution history
- Results display

### Backend API

Responsibilities:

- Session management
- Workflow storage
- Workflow execution
- Security validation

### Workflow Engine

Responsible for:

- Loading workflows
- Executing actions
- Tracking results

### SQLite

Stores:

- Sessions
- Workflows
- Workflow runs
- User metadata

### Sandbox Directories

Each user receives an isolated workspace:

```text
/sandboxes/
  session-a/
  session-b/
  session-c/
```

Example:

```text
/12345/
├── Downloads/
├── Documents/
├── Photos/
└── Invoices/
```

---

# Demo Workflow Lifecycle

## 1. Session Creation

User opens the demo.

Backend:

1. Creates session ID
2. Creates sandbox directory
3. Populates sample files

Example:

```text
/sandboxes/12345/
```

---

## 2. Workflow Creation

Example rule:

```text
If file extension = .pdf
Move file to Documents/PDFs
```

Stored as workflow definition.

---

## 3. Workflow Execution

Workflow engine:

1. Loads sandbox
2. Loads workflow
3. Executes actions

Example:

```text
Downloads/a.pdf
        ↓
Documents/PDFs/a.pdf
```

---

## 4. Results

Example output:

```json
{
  "filesMoved": 12,
  "foldersCreated": 3
}
```

---

# Advantages of Sandbox Demo

## Safety

Users cannot damage their own files.

---

## Easy Onboarding

No:

- Desktop installation
- Local agent
- Browser permissions

Required.

---

## Strong Portfolio Presentation

Visitors can immediately interact with a working system.

---

## Simplified Operations

No need to support:

- Windows
- macOS
- Linux filesystem peculiarities

Initially.

---

# Limitations

## Not Real Files

Users may ask:

> Can this organize my Downloads folder?

The answer in demo mode is no.

Clear messaging is required.

---

## Cleanup Requirements

Sandboxes accumulate data over time.

Need automated deletion of expired sessions.

---

## Scalability Constraints

The minimal architecture is suitable for:

- Demonstrations
- Portfolio usage
- Small-scale traffic

Not ideal for large-scale production workloads.

---

# Security Risks and Mitigations

## 1. Path Traversal

### Risk

Attacker submits:

```text
../../../etc/passwd
```

If paths are concatenated blindly, the application may access files outside the sandbox.

### Fix

Always:

1. Resolve the absolute path
2. Verify it remains inside sandbox root

Pseudo-check:

```text
resolvedPath.startsWith(sandboxRoot)
```

Reject anything outside.

### Priority

CRITICAL

---

## 2. Symlink Escapes

### Risk

Attacker creates:

```text
Downloads/link -> /etc
```

Workflow accesses:

```text
Downloads/link/passwd
```

Potentially exposing host files.

### Fix

Options:

- Reject symlinks entirely
- Resolve real paths and verify sandbox boundaries

### Priority

CRITICAL

---

## 3. Resource Exhaustion

### Risk

User creates:

- Millions of files
- Deep folder trees
- Huge uploads

Result:

- Disk exhaustion
- Performance degradation

### Fix

Per-session quotas.

Example:

```text
Maximum storage: 50 MB
Maximum files: 1,000
Maximum folders: 1,000
```

### Priority

HIGH

---

## 4. Infinite Workflow Loops

### Risk

Workflow repeatedly triggers itself.

Example:

```text
Move File
    ↓
Triggers Workflow
    ↓
Move File
    ↓
Triggers Workflow
```

### Fix

Execution limits:

```text
Maximum nodes executed
Maximum runtime
Maximum recursion depth
```

Example:

```text
Runtime limit: 10 seconds
Node limit: 100
```

### Priority

HIGH

---

## 5. Concurrent Execution Issues

### Risk

User launches multiple runs simultaneously.

Potential outcomes:

- Race conditions
- Missing files
- Corrupted state

### Fix

Allow only one active workflow execution per session.

Or implement execution locking.

### Priority

MEDIUM

---

## 6. Storage Growth

### Risk

Old sandboxes accumulate forever.

### Fix

Scheduled cleanup task.

Example:

```text
Delete sessions older than 1 hour
```

### Priority

HIGH

---

## 7. Upload Abuse

### Risk

Large uploads consume disk and bandwidth.

### Fix

Upload limits.

Example:

```text
Max file size: 10 MB
Max workspace size: 50 MB
```

### Priority

HIGH

---

# Scalability Assessment

## Low Traffic

10–50 concurrent users

Expected result:

- No issues

---

## Medium Traffic

100–500 concurrent users

Expected result:

- Still feasible
- Monitor disk I/O

---

## High Traffic

1,000+ concurrent users

Likely bottlenecks:

- Filesystem I/O
- Session storage
- Workflow execution contention

At that point consider:

```text
API
 ↓
Queue
 ↓
Workers
 ↓
Storage
```

And potentially:

- PostgreSQL
- Redis
- Dedicated workers
- Containerized execution

---

# Future Evolution

## Current

```text
Workflow Engine
       ↓
Sandbox Filesystem
```

## Self-Hosted

```text
Workflow Engine
       ↓
Host Filesystem
```

## Recommended Abstraction

```text
FileProvider
├── SandboxFileProvider
├── LocalHostFileProvider
├── S3FileProvider
└── SMBFileProvider
```

The workflow engine remains independent of the underlying storage implementation.

---

# Final Recommendation

For a portfolio-quality first version:

- Frontend
- Backend API
- SQLite
- Sandbox directories
- Workflow engine
- Session expiration
- Storage quotas
- Path validation
- Symlink protection
- Cleanup job

Focus on correctness, sandbox isolation, and workflow design before introducing heavier infrastructure such as containers, queues, Redis, or Kubernetes.
