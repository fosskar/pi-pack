# llm-wiki

Safely operate an existing Git-backed LLM wiki through Pi.

The extension embeds the [LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) and the [Open Knowledge Format v0.2 baseline](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md). Repository guidance can add conventions, but it is not required.

## Repository contract

The repository must:

- Be named `llm-wiki`.
- Be a Git repository.
- Contain a top-level `raw/` directory.
- Contain a top-level `wiki/` directory.
- Have a configured upstream branch.

`raw/` contains immutable source material. `wiki/` contains derived knowledge.

The extension does not use or create a `.llm-wiki/` directory.

## Discovery

For each directory from the Pi working directory to the filesystem root, the extension checks:

1. The directory itself.
2. Its `llm-wiki/` child.

The extension stops when discovery finds no repository or several repositories.

Use `LLM_WIKI_PATH` to select a repository explicitly:

```bash
export LLM_WIKI_PATH="$HOME/Projects/llm-wiki"
```

Optional settings:

```bash
export LLM_WIKI_BRANCH="main"
export LLM_WIKI_REMOTE="git@github.com:owner/llm-wiki.git"
```

`LLM_WIKI_BRANCH` defaults to `main`. `LLM_WIKI_REMOTE` is required when the extension must create the clone. When set for an existing clone, it also verifies the remote URL.

## Repository guidance

The `status` action reports these root files when they exist:

- `AGENTS.md`
- `CLAUDE.md`
- `SPEC.md`
- `WIKI_SCHEMA.md`
- `llm-wiki.md`

The agent must read every reported file before semantic work. These files can define repository-specific page types, layout, provenance, and workflows. They cannot weaken the extension's Git safety rules.

## Tool actions

The extension registers one `llm_wiki` tool:

- `status` synchronizes the clone and reports its commit and guidance files.
- `search` performs bounded fixed-string search.
- `read` reads bounded text files and returns their SHA-256 hashes.
- `apply` validates, commits, and pushes one complete semantic operation.

Every `apply` file has one role:

| Role      | Required location | Rules                                                        |
| --------- | ----------------- | ------------------------------------------------------------ |
| `source`  | `raw/`            | New immutable source material. Existing files cannot change. |
| `concept` | `wiki/`           | Markdown with OKF frontmatter and a non-empty `type`.        |
| `index`   | `wiki/`           | Markdown named `index.md`.                                   |
| `log`     | `wiki/`           | Markdown named `log.md`.                                     |
| `schema`  | Repository root   | A supported repository guidance file.                        |

An update to an existing writable file requires the SHA-256 hash returned by `read`. The extension rejects stale hashes. `apply` accepts text content only.

## Git transaction

Before each operation, the extension:

1. Takes an exclusive repository lock.
2. Stops if the clone is dirty.
3. Fetches the configured remote.
4. Stops on divergence.
5. Fast-forwards the local branch.

For a mutation, it then:

1. Creates a temporary Git worktree.
2. Applies the complete file set.
3. Validates paths, roles, hashes, frontmatter, and the staged diff.
4. Commits with Git hooks disabled.
5. Pushes without force.
6. Reconciles the local clone.

The extension never stashes, rebases, merges divergence, resolves conflicts, or force-pushes.

## Commands

- `/wiki-capture <source>` captures and ingests one source.
- `/wiki-query <question>` answers from the wiki without mutation.
- `/wiki-observe <fact>` preserves a user-stated durable fact.
- `/wiki-lint` inspects the wiki without mutation.
- `/wiki-status` synchronizes and reports repository status.
