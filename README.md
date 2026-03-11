# pi-pack

skills, extensions, and prompts for [pi](https://github.com/badlogic/pi-mono) coding agent.

## install

```bash
pi install git:github.com/fosskar/pi-pack
```

or add to `settings.json`:

```json
{ "packages": ["git:github.com/fosskar/pi-pack"] }
```

## what's included

### skills

| name | description |
|------|-------------|
| [`simplify`](#simplify) | review code for reuse, quality, and efficiency, then fix issues |
| [`batch`](#batch) | orchestrate large-scale parallel changes across a codebase |
| [`qmd`](#qmd-skill) | persistent memory workflow: retrieve/save/forget durable project knowledge |

### extensions

| name | description |
|------|-------------|
| [`qmd`](#qmd) | qmd lookup + persistent project memory integration |

### prompts

| name | description |
|------|-------------|
| [`jjcommit`](#jjcommit) | atomic commit workflow for jj (jujutsu) |

---

## skills

### qmd (skill) {#qmd-skill}

memory-first behavior layer for the qmd extension.

what it teaches:
- retrieve relevant memory first (`memory_search`), never dump full memory
- save durable decisions/preferences (`memory_save`)
- correct stale memory (`memory_forget` + new save)
- use qmd lookups (`qmd_query`, `qmd_get`) for indexed docs/code

```
# usually auto-applied
# can still invoke manually:
/skill:qmd
```

### simplify

reviews code for reuse, quality, and efficiency issues, then fixes them. works on specific files/modules, recent changes, or whatever you point it at.

```
/skill:simplify                          # falls back to git diff
/skill:simplify modules/auth/            # review a specific module
/skill:simplify focus on memory leaks    # review with a specific focus
```

performs three reviews:
- **code reuse** — finds existing utilities that could replace code, flags duplicated functionality
- **code quality** — flags redundant state, parameter sprawl, copy-paste, leaky abstractions, stringly-typed code, dead code
- **efficiency** — catches unnecessary work, missed concurrency, hot-path bloat, TOCTOU anti-patterns, memory leaks

### batch

orchestrates large-scale changes across a codebase. decomposes work into 5–30 independent units with a plan-then-execute flow. manual invocation only. requires git.

```
/skill:batch migrate from react to vue
/skill:batch replace all uses of lodash with native equivalents
```

## extensions

### qmd

[qmd](https://github.com/tobi/qmd) integration — indexes docs/code + adds durable project memory.

memory behavior:
- auto retrieves only relevant memory per prompt (not full memory dump)
- memory files stored globally at `~/.pi/agent/qmd-memory/<project-hash>/` (no repo spam)
- autosave default: on. can disable explicitly.
- autosave triggers only on durable-signal keywords (`remember`, `preference`, `decision`, `rule`, `convention`, `always`, `never`)
- autosave rate limit (when enabled): max 1 auto note / 5 min
- degraded fallback: if hybrid/vector fails, switches to lexical-only mode and shows reason in `/memory status`

quick commands:
- `/memory help` — show memory subcommands
- `/memory status` — on/off, autosave mode, cooldown, file count
- `/memory on` / `/memory off`
- `/memory autosave on` / `/memory autosave off`
- `/memory rebuild` — refresh memory index

memory tools:
- `memory_search` | search persistent project memory
- `memory_save` | save durable memory note (deduped)
- `memory_status` | integration health + mode
- `memory_forget` | delete matching memory notes

qmd tools:
- `qmd_query` | search index (keyword/vector/hybrid)
- `qmd_get` | retrieve doc by path or #docid
- `qmd_update` | re-index all collections, optionally embed
- `qmd_collection_add` | add dir/file as collection
- `qmd_collection_remove` | remove collection
- `qmd_collection_list` | list collections
- `qmd_status` | index overview
- `qmd_embed` | create/refresh embeddings

fix semantic/hybrid backend (common on NixOS):
```bash
mkdir -p ~/.cache/node-llama-cpp/xpack
nix shell nixpkgs#gnumake nixpkgs#cmake nixpkgs#gcc nixpkgs#python3 -c qmd query "test"
```
if still on old qmd, update to latest:
```bash
npm install -g @tobilu/qmd@latest
qmd --version
```

## prompts

### jjcommit

atomic commit workflow for jj (jujutsu). splits unrelated changes, lowercase imperative messages, moves main bookmark.

```
/jjcommit
```

## license

MIT
