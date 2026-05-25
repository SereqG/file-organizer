# Path Selection Security – Initial Workflow Stage

## Goal

At this stage, the application is focused only on validating the directory path selected or pasted by the user.

The purpose of this validation layer is **not** to fully secure file operations yet, but to:

- reject obviously dangerous locations,
- prevent accidental selection of system directories,
- reduce the risk of destructive workflows,
- validate that the selected location is suitable for further processing.

This stage acts as a **Path Gatekeeper** before the actual workflow begins.

---

# Scope of This Stage

The application does **NOT** yet:

- analyze file contents,
- scan directories recursively,
- classify files,
- use AI,
- validate MIME types,
- inspect file structures.

Only the selected path itself is validated.

---

# Recommended Validation Flow

```text
INPUT PATH
    ↓
Normalize Path
    ↓
Resolve Symlinks / Canonical Path
    ↓
Check Path Exists
    ↓
Check Is Directory
    ↓
Check Forbidden Locations
    ↓
Check Root / High-Risk Locations
    ↓
Check Basic Permissions
    ↓
ACCEPT / REJECT
```

---

# 1. Absolute Path Validation

The selected path should always be:

- absolute,
- syntactically valid for the current operating system,
- normalized before any further checks.

## Invalid Examples

### Windows

```text
..\Documents
C:Documents
```

### Linux/macOS

```text
../../etc
```

---

# 2. Path Normalization

The path should always be normalized before validation.

Normalization should remove:

- `..`
- `.`
- duplicate separators,
- trailing separators.

## Example

Input:

```text
C:\Users\User\..\Windows\
```

Normalized:

```text
C:\Windows
```

---

# 3. Canonical / Real Path Resolution

The application should resolve:

- symlinks,
- junctions,
- aliases,
- redirected paths.

Validation must always operate on the resolved canonical path.

## Why It Matters

Example:

```text
D:\Photos
```

could actually point to:

```text
C:\Windows
```

Without resolving symlinks, blacklist checks can be bypassed.

---

# 4. Path Existence Check

The selected location must exist.

If the path does not exist:

- validation fails,
- workflow does not continue.

---

# 5. Directory Type Validation

The selected path must be a directory.

Reject:

- files,
- devices,
- virtual filesystem entries,
- unsupported special locations.

---

# 6. Forbidden System Locations

At this stage, the safest and simplest approach is to use a static blacklist of dangerous system locations.

The goal is to prevent the user from accidentally selecting critical system directories.

## Important

The application should compare the blacklist against the canonical/resolved path, not the raw user input.

---

# Recommended Forbidden Paths

## Windows

```text
C:\
C:\Windows
C:\Program Files
C:\Program Files (x86)
C:\ProgramData
C:\Recovery
C:\System Volume Information
```

## Linux/macOS

```text
/
 /bin
 /boot
 /dev
 /etc
 /lib
 /proc
 /sys
 /usr
 /var
 /System
```

---

# 7. Root / High-Risk Directory Blocking

Some directories are not strictly system directories but are still too dangerous for bulk workflow execution.

## Examples

### Windows

```text
C:\
```

### Linux/macOS

```text
/
 /home
```

These locations may contain:

- massive numbers of files,
- user profiles,
- application data,
- critical system resources.

The application should either:

- block them entirely,
- or require explicit advanced confirmation.

---

# 8. Basic Permission Validation

At this stage, only basic permission checks are needed.

Recommended checks:

- read access,
- write access.

Deep operational testing is unnecessary during initial path validation.

---

# 9. What Should NOT Be Done at This Stage

To keep the validation layer lightweight and predictable, the application should NOT:

- scan file contents,
- analyze directory structures,
- inspect MIME types,
- classify files,
- run AI models,
- perform recursive traversal,
- execute workflow logic.

Those responsibilities belong to later stages.

---

# Recommended Architecture

This stage should behave as a lightweight security gatekeeper.

## Responsibilities

- validate path format,
- normalize input,
- resolve symlinks,
- block dangerous locations,
- verify accessibility.

## Non-Responsibilities

- file analysis,
- content analysis,
- workflow execution,
- AI classification.

---

# Suggested Error Model

Instead of generic messages like:

```text
Invalid path
```

the application should return structured error codes.

## Example

```json
{
  "code": "SYSTEM_DIRECTORY_BLOCKED",
  "message": "Selected path points to a protected system directory."
}
```

This improves:

- debugging,
- logging,
- telemetry,
- frontend UX,
- localization.

---

# Minimal Recommended Security Checklist

## MUST HAVE

- absolute path validation,
- path normalization,
- canonical path resolution,
- existence check,
- directory type validation,
- forbidden path blacklist,
- root/high-risk directory blocking,
- basic read/write permission checks.

This is sufficient for the initial workflow stage and provides strong protection against:

- accidental system directory selection,
- path traversal attempts,
- symlink bypasses,
- destructive root-level workflows.
