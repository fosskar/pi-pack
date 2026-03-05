# qmd

[qmd](https://github.com/badlogic/qmd) integration for pi. indexes documentation and code for semantic search.

## tools

| tool | description |
|------|-------------|
| `qmd_query` | search index with keyword, vector, or hybrid query |
| `qmd_get` | retrieve a doc by path or #docid |
| `qmd_update` | re-index all collections, optionally embed |
| `qmd_collection_add` | add a directory/file as a named collection |
| `qmd_collection_remove` | remove a collection |
| `qmd_collection_list` | list all collections |
| `qmd_status` | show index overview |
| `qmd_embed` | create/refresh vector embeddings |

## prerequisites

`qmd` must be installed and on PATH.

## example

> "add my project docs to qmd as 'mydocs', filter for markdown, and embed them"

the agent calls `qmd_collection_add` → `qmd_update` → `qmd_embed` automatically.
