# batch

orchestrates large-scale changes across a codebase. provide a description and batch decomposes the work into independent units with a plan-then-execute flow.

usage: `/skill:batch migrate from react to vue`

phases:
1. **research** — explores the codebase to understand scope and conventions
2. **plan** — decomposes into 5–30 independent units, presents for approval
3. **execute** — implements each unit, runs tests, commits
4. **report** — summary table of completed/failed units

requires a git repository. manual invocation only (won't auto-trigger).
