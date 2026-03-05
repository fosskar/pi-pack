---
name: simplify
description: Review code for reuse, quality, and efficiency issues, then fix them. Works on recently changed files, specific files/modules, or whatever you point it at. Pass optional text to focus on specific concerns.
---

# Simplify: Code Review and Cleanup

$ARGUMENTS

## Phase 1: Identify Scope

Determine what to review:
- If the user specified files, modules, or directories — review those
- If the user described a concern — find the relevant code
- If nothing was specified — fall back to `git diff` (or `git diff HEAD` if staged) to review recent changes
- If no git changes either — ask what to review

## Phase 2: Review

Perform all three reviews on the target code.

### Review 1: Code Reuse

1. **Search for existing utilities and helpers** that could replace code. Use grep/search to find similar patterns elsewhere in the codebase — utility directories, shared modules, and adjacent files.
2. **Flag any function that duplicates existing functionality.** Suggest the existing function instead.
3. **Flag inline logic that could use an existing utility** — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar.

### Review 2: Code Quality

1. **Redundant state**: state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls
2. **Parameter sprawl**: too many parameters instead of generalizing or restructuring
3. **Copy-paste with slight variation**: near-duplicate code blocks that should be unified
4. **Leaky abstractions**: exposing internal details that should be encapsulated, or breaking existing abstraction boundaries
5. **Stringly-typed code**: using raw strings where constants, enums, or branded types already exist in the codebase
6. **Dead code**: unused functions, unreachable branches, commented-out blocks that should be removed

### Review 3: Efficiency

1. **Unnecessary work**: redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns
2. **Missed concurrency**: independent operations run sequentially when they could run in parallel
3. **Hot-path bloat**: blocking work on startup or per-request/per-render hot paths
4. **Unnecessary existence checks**: pre-checking file/resource existence before operating (TOCTOU anti-pattern) — operate directly and handle the error
5. **Memory**: unbounded data structures, missing cleanup, event listener leaks
6. **Overly broad operations**: reading entire files when only a portion is needed, loading all items when filtering for one

## Phase 3: Fix Issues

Fix each issue directly. If a finding is a false positive or not worth addressing, skip it.

When done, briefly summarize what was fixed (or confirm the code was already clean).
