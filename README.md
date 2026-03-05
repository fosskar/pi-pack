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

## skills

### simplify

reviews recently changed files for code reuse, quality, and efficiency issues, then fixes them. run after implementing a feature or bug fix. pass optional text to focus on specific concerns.

```
/skill:simplify
/skill:simplify focus on memory efficiency
```

performs three reviews:
- **code reuse** — finds existing utilities that could replace new code
- **code quality** — flags redundant state, parameter sprawl, copy-paste, leaky abstractions, stringly-typed code
- **efficiency** — catches unnecessary work, missed concurrency, hot-path bloat, TOCTOU anti-patterns, memory leaks

### batch

orchestrates large-scale changes across a codebase. decomposes work into 5–30 independent units with a plan-then-execute flow. manual invocation only. requires git.

```
/skill:batch migrate from react to vue
/skill:batch replace all uses of lodash with native equivalents
```

## extensions

### qmd

[qmd](https://github.com/badlogic/qmd) integration — indexes documentation and code for semantic search. requires `qmd` on PATH.

| tool | description |
|------|-------------|
| `qmd_query` | search index (keyword, vector, or hybrid) |
| `qmd_get` | retrieve doc by path or #docid |
| `qmd_update` | re-index all collections, optionally embed |
| `qmd_collection_add` | add a directory/file as a named collection with optional glob mask |
| `qmd_collection_remove` | remove a collection |
| `qmd_collection_list` | list all collections |
| `qmd_status` | show index overview |
| `qmd_embed` | create/refresh vector embeddings |

## prompts

### jjcommit

atomic commit workflow for jj (jujutsu). splits unrelated changes, lowercase imperative messages, moves main bookmark.

```
/jjcommit
```

## license

MIT
