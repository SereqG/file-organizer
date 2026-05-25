# CLAUDE.md

## Project Overview

Project focused on intelligent file organization and automation.

Main goals:
- organize files using rule-based workflows,
- process file content with AI when required,
- build modular and independently scalable features,
- keep architecture simple, maintainable and highly composable.

Additional project documentation may exist inside the `/docs` directory.

---

# General Rules

- Always prioritize simplicity and maintainability.
- Prefer small and composable solutions over large abstractions.
- Avoid overengineering.
- Keep files short and focused.
- Avoid hidden side effects.
- Avoid magic values and implicit behavior.
- Every function should have a single responsibility.
- Prefer composition over inheritance.
- Avoid premature optimization.
- Avoid dead code and unused abstractions.
- Refactor duplicated logic early.
- Never introduce temporary hacks without explicitly marking them.
- Do not add dependencies without clear justification.
- Changes should be minimal and localized whenever possible.

---

# Cooperation Rules (Claude Code)

## Before Implementation

Before implementing changes:
- carefully analyze the existing instructions,
- identify missing information,
- ask clarifying questions when logic is unclear,
- challenge inconsistent assumptions,
- verify edge cases before implementation.

If a requested change:
- affects multiple domains,
- requires broad refactoring,
- changes core architecture,
- or introduces significant complexity,

then:
- explicitly inform the user,
- propose splitting work into smaller tasks,
- define implementation stages before coding.

Always prefer iterative delivery over large rewrites.

---

# Backend Architecture

## General

Backend uses Vertical Slice Architecture.

Each slice should:
- represent one complete business capability,
- be independent,
- contain only logic related to its feature,
- minimize coupling with other slices.

Slices should remain:
- small,
- modular,
- easy to remove or extend.

Avoid large shared service layers.

---

## API Convention

All API endpoints must follow:

```txt
/<domain_name>/api/*
```

Examples:

```txt
/files/api/upload
/workflows/api/create
/ai/api/analyze
```

---

## Backend Structure Example

```txt
backend/
  modules/
    files/
      api/
      application/
      domain/
      infrastructure/

    workflows/
      api/
      application/
      domain/
      infrastructure/
```

---

# AI Processing Rules

AI should only be used when:
- file content analysis is required,
- semantic understanding is required,
- standard deterministic logic is insufficient.

Core business logic must NOT depend directly on AI providers.

Always isolate:
- prompts,
- AI adapters,
- model communication,
- parsing logic.

AI integrations should be replaceable.

Prefer deterministic workflows whenever possible.

---

# Frontend Architecture

Frontend should use clear and predictable folder organization.

## Structure

```txt
frontend/
  components/
  hooks/
  utils/
  variables/
  types/
```

---

## Components

Rules:
- one component per file,
- components must remain small,
- split large UI into smaller pieces,
- avoid deeply nested JSX,
- avoid business logic inside UI components.

Prefer:
- presentational components,
- composition,
- reusable primitives.

---

## Hooks

Rules:
- hooks should be short and focused,
- one responsibility per hook,
- avoid overly generic hooks,
- move heavy logic outside components when possible.

---

## Types

- Keep shared types centralized.
- Avoid duplicated type definitions.
- Prefer explicit typing over `any`.

---

# Naming Conventions

## General

Prefer clear and predictable naming.

Avoid:
- abbreviations,
- vague names,
- generic utility naming.

Good:
- `createWorkflow`
- `analyzeFileContent`
- `workflowRepository`

Bad:
- `handleStuff`
- `processData`
- `utils`

---

# Code Quality

## Functions

- Keep functions short.
- Prefer early returns.
- Reduce nesting depth.
- Avoid functions with many arguments.
- Extract complex conditions into named variables.

---

## Files

Prefer small files.

Recommended:
- under ~200 lines per file,
- under ~50 lines per function whenever possible.

---

## Comments

Write comments only when:
- explaining WHY,
- documenting non-obvious decisions,
- clarifying complex constraints.

Do not comment obvious code.

---

# Error Handling

- Never swallow errors silently.
- Use structured error handling.
- Return meaningful error messages.
- Log technical details separately from user-facing messages.

---

# Security

- Never trust file input.
- Validate all uploaded files.
- Sanitize external input.
- Isolate file-processing operations.
- Avoid executing arbitrary file content.
- Treat AI-generated output as untrusted input.

---

# Definition of Done

A task is complete only if:
- logic works correctly,
- code is readable,
- edge cases are handled,
- naming is consistent,
- unnecessary complexity was avoided,
- code follows architecture rules,
- no dead code was introduced.

---

# Documentation

Additional documentation, decisions and architecture notes may be stored inside:

```txt
/docs
```

Keep documentation concise and practical.
