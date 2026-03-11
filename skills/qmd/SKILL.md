---
name: qmd
description: persistent project memory via qmd. use memory_* tools for durable facts, decisions, and progress. use qmd_* tools for repo/docs lookup.
---

# qmd memory mode

use this whenever user asks about prior decisions, long-running tasks, or "remember this".

## rule

do not load all memory. retrieve only relevant memory with `memory_search`.

## workflow

1. for fresh work: use normal repo tools (`read`, `edit`, `bash`) + `qmd_query` for external indexed docs.
2. before major action, run `memory_search` with task-specific query.
3. when user gives durable preference/decision, call `memory_save`.
4. after confusion or contradiction, run `memory_search` again with tighter query.
5. if memory stale/wrong, fix by `memory_forget` + `memory_save` corrected note.

## what to save

save only high-value durable items:
- user preferences (style, tooling, constraints)
- architectural decisions
- recurring pitfalls + fixes
- project conventions

do not save:
- trivial temporary chatter
- data duplicated in source files unless it is a distilled decision

## query patterns

- exact term known: `qmd_query(mode="search")`
- conceptual unknown term: `qmd_query(mode="query")` or `qmd_query(mode="vsearch")`
- personal/project memory recall: `memory_search`

## maintenance

- if user updates deps/docs, suggest `qmd_update` (and `qmd_embed` if vector working)
- if memory gets noisy, use `memory_forget` on bad chunks
- use `memory_status` when behavior seems off
