# sediment-memory

Extract durable facts from Pi conversations and recall them in later sessions through [Sediment](https://github.com/rendro/sediment).

## Requirements

The extension needs the `sediment` executable. The Nix package replaces the executable path at build time. Other installations use `sediment` from `PATH`.

Optional environment variables:

```bash
export SEDIMENT_BIN=/path/to/sediment
export SEDIMENT_DB="$XDG_STATE_HOME/sediment/data"
```

The default database is:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/sediment/data
```

The parent `sediment/` directory also contains access data and the durable extraction spool.

## Capture

The extension collects settled conversation turns. Every settled turn is mirrored to a pending spool file, so a crash loses at most the turn in flight. Every four turns the pending batch becomes a durable spool job and background extraction starts. Session shutdown flushes a shorter pending batch; a pending file orphaned by a dead session is drained after one hour.

Each batch carries the last two turns of the previous batch as context-only records: the extractor can resolve references across the batch boundary but cannot cite them as evidence, so re-seen turns produce no duplicate facts.

Extraction keeps evidence-backed items such as:

- User facts and preferences.
- Identifiers.
- Successful command examples.
- Open tasks.

A newer fact can replace a semantically similar older fact. Session compaction summaries are stored as a narrative memory layer.

Failed extraction jobs remain in the spool. A later session retries them. Successful jobs are removed only after all memory writes complete.

## Recall

Before each agent prompt, the extension searches Sediment. The query blends the prompt with the last three settled turns, so a terse prompt still recalls against the conversation topic; injected skill blocks are stripped first. It injects at most three results above the similarity threshold into the system prompt.

Recalled content is marked as untrusted historical data. The agent must not follow instructions contained in a memory.

The `memory_search` tool performs explicit semantic search:

```json
{
  "query": "previous deployment command",
  "limit": 5
}
```

The `memory_store` tool stores one item immediately, bypassing batched extraction. The model calls it when the user explicitly asks to remember something:

```json
{
  "kind": "pref",
  "subject": "commit style",
  "body": "Linux-kernel style commit messages without trailers."
}
```

A later store with the same subject supersedes the earlier item.

The `memory_forget` tool deletes one item by the id shown in `memory_search` results, for memories the user declares wrong or outdated:

```json
{
  "id": "eb52a1d4-e7a0-4e0a-957b-b58ad30ffce1"
}
```

## Session control

```text
/memory status
/memory on
/memory off
/memory
```

`/memory` without an argument toggles memory for the current session. The extension stores this choice as `memory-off` in the session directory.

Disabling memory stops automatic capture, automatic recall, compaction storage, spool processing for that session, and `memory_search`.

## Maintenance and privacy

Sediment consolidation runs after approximately 50 database writes. The extension continues without memory when Sediment is unavailable.

Memory data can contain personal information from conversations. Protect the state directory as private data. Remove or edit memories with Sediment tooling. Deleting a Pi session does not delete memories already stored in Sediment.
