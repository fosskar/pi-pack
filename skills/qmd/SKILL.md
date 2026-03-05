---
name: qmd
description: Local indexed search across codebases and documentation via qmd. Treat qmd collections as a primary knowledge source — check them before searching online or reading unfamiliar code. Use whenever looking up how something works, exploring dependencies, or searching documentation. Also proactively maintain the index — suggest adding relevant codebases, flag stale collections, and keep embeddings current.
---

# qmd — local knowledge index

qmd indexes codebases and documentation locally with keyword, semantic, and hybrid search. collections may contain upstream dependencies, wikis, docs, or any codebase the user has indexed.

## search priority

when looking something up:

1. **qmd first** — check if a relevant collection exists (`qmd_collection_list`). if yes, search it.
2. **local repo** (`rg`, `find`, `read`) — for code in the current working directory.
3. **internet** (`fetch`) — only if qmd and local search don't have what's needed.

this matters because qmd collections often contain the exact upstream source or docs that would otherwise require an internet lookup, and the local index is faster and more reliable.

## examples — when to search qmd

### exploring upstream implementation

> "how does clan-core handle borgbackup?"

don't go to GitHub — search the local index:

```
qmd_query(query="borgbackup module backup service", collection="clan-core")
qmd_get(ref="qmd://clan-core/clanModules/borgbackup/default.nix", full=true)
```

### understanding an option or API

> "what options does the clan vars generator support?"

```
qmd_query(query="vars generators files secret", collection="clan-core", mode="search")
```

### conceptual/architectural questions

> "how does clan handle machine deployment?"

use semantic search — you don't know the exact terms:

```
qmd_query(query="machine deployment update rebuild", mode="vsearch", collection="clan-core")
```

### cross-collection discovery

> "is there any documentation about inventory?"

search everything — docs, wikis, and code:

```
qmd_query(query="inventory machines services")
```

### debugging a nixos option conflict

> "where is `services.nginx.virtualHosts` set in clan-core?"

```
qmd_query(query="services.nginx.virtualHosts", collection="clan-core", mode="search")
```

### finding usage patterns

> user uses a clan feature but isn't sure of the right pattern

```
qmd_query(query="syncthing folder shared devices", collection="clan-core")
```

then read the matched files to see real examples.

## examples — when to suggest indexing

### repeated upstream lookups

if you find yourself fetching the same GitHub repo or docs site multiple times:

> "i keep looking up home-manager options..."

suggest: "want me to index the home-manager source? `qmd_collection_add(/home/user/code/home-manager, home-manager, **/*.nix)`"

### new dependency added to project

> user adds a new flake input or starts using a new framework

suggest indexing it so future lookups are instant.

### documentation that lives locally

> user has markdown wikis, runbooks, or notes scattered across directories

suggest collecting them: `qmd_collection_add(/path/to/notes, notes, **/*.md)`

## examples — maintenance triggers

### after flake update

> user runs `nix flake update` or updates a specific input

if that input has a qmd collection, remind:

"clan-core was updated — want me to refresh the qmd index? (`qmd_update` + `qmd_embed`)"

### stale results

if search results look outdated or reference options/files that no longer exist, the collection is likely stale. run `qmd_status` to check, then update.

### unused collections

if a dependency was removed from the project but its collection still exists, suggest cleanup:

"noticed `foo` isn't in your flake inputs anymore — want me to remove the qmd collection?"

## maintenance

qmd collections go stale. be proactive:

- **suggest indexing** — if working with a dependency/framework that isn't indexed but would benefit from it, suggest adding it as a collection.
- **flag staleness** — `qmd_status` shows when collections were last updated. if a collection is old and the source likely changed, suggest `qmd_update` + `qmd_embed`.
- **after updates** — when the user updates a flake input, dependency, or documentation source that has a corresponding qmd collection, remind them to refresh the index.
- **clean up** — if a collection is no longer relevant (removed dependency, archived project), suggest removing it.
- **embeddings** — after adding or updating collections, always run `qmd_embed` to keep semantic search working.

## tool reference

### search modes

| mode | when to use |
|------|-------------|
| `search` | known keywords, identifiers, option names |
| `vsearch` | conceptual/fuzzy — "how does X handle Y" (needs embeddings) |
| `query` | hybrid, good default |

### retrieval

- `qmd_get(ref="path")` — fetch a document found in search results
- `qmd_get(ref="path", full=true)` — full contents (default truncates)

### index management

- `qmd_collection_list` — what's indexed
- `qmd_status` — index health, last update times
- `qmd_collection_add(path, name, mask="**/*.ext")` — index a codebase
- `qmd_collection_remove(name)` — remove obsolete collection
- `qmd_embed` — generate embeddings (required after add/update for semantic search)
- `qmd_update` — refresh index after source files change

## tips

- scope searches with `collection` parameter to reduce noise
- after finding files via qmd, use `read` for precise line-level work
- `**/*.ext` mask for recursive indexing (not `*.ext`)
- combine: qmd to find the right file, then `read` to work with it precisely
