---
name: batch
description: Orchestrate large-scale changes across a codebase in parallel. Provide a description of the change and batch researches the codebase, decomposes the work into independent units, and presents a plan for approval. Requires a git repository.
disable-model-invocation: true
---

# Batch: Parallel Work Orchestration

You are orchestrating a large, parallelizable change across this codebase.

## User Instruction

$ARGUMENTS

## Phase 1: Research and Plan

1. **Understand the scope.** Deeply research what this instruction touches. Find all the files, patterns, and call sites that need to change. Understand the existing conventions so the migration is consistent.

2. **Decompose into independent units.** Break the work into 5–30 self-contained units. Each unit must:
   - Be independently implementable (no shared state with sibling units)
   - Be mergeable on its own without depending on another unit landing first
   - Be roughly uniform in size (split large units, merge trivial ones)

   Scale the count to the actual work: few files → closer to 5; hundreds of files → closer to 30. Prefer per-directory or per-module slicing over arbitrary file lists.

3. **Determine the test recipe.** Figure out how to verify each change works end-to-end — not just that unit tests pass. Look for:
   - An existing e2e/integration test suite
   - A dev-server + curl pattern (for API changes)
   - Manual verification steps

4. **Write the plan.** Include:
   - A summary of what you found during research
   - A numbered list of work units — for each: a short title, the list of files/directories it covers, and a one-line description of the change
   - The test recipe
   - The exact worker instructions you will give each unit

5. **Present the plan for approval** before proceeding.

## Phase 2: Execute

Once the plan is approved, implement each work unit. For each unit:

1. Implement the change
2. Run the project's test suite
3. Follow the test recipe from the plan
4. Commit with a clear message

## Phase 3: Report

When all units are complete, render a summary table:

| # | Unit | Status |
|---|------|--------|
| 1 | <title> | done/failed |

And a one-line summary (e.g., "22/24 units completed").
