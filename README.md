# pi-pack

Shareable extensions, skills, prompts, and themes for Pi.

## Install

### Home Manager

Use this method on Nix systems. The module deploys all resources and installs their required CLI packages.

Add the flake input:

```nix
{
  inputs.pi-pack.url = "github:fosskar/pi-pack";
}
```

Import and enable the Home Manager module:

```nix
{
  imports = [ inputs.pi-pack.homeModules.default ];
  programs.pi-pack.enable = true;
}
```

### Pi package manager

Install all resources directly through Pi:

```bash
pi install git:github.com/fosskar/pi-pack
```

Pi records the package in `~/.pi/agent/settings.json`. Use `pi config` to enable or disable individual resources.

The `llm-wiki` extension requires Git in `PATH`. It searches the working directory and its parents for a Git repository named `llm-wiki` with `raw/` and `wiki/`. Use these optional overrides when automatic discovery is not sufficient:

```bash
export LLM_WIKI_PATH="$HOME/Projects/llm-wiki"
export LLM_WIKI_REMOTE="git@github.com:owner/llm-wiki.git" # create or verify the clone
export LLM_WIKI_BRANCH="main"                              # default: main
```

The `sediment-memory` extension also requires Sediment in `PATH`. Nix users without Home Manager can install it separately:

```bash
nix profile install github:fosskar/pi-pack#sediment
```

### Use one skill from Nix

Home Manager can deploy one skill for another agent:

```nix
{
  home.file.".claude/skills/osm".source = "${inputs.pi-pack}/skills/osm";
}
```

## Contents

### Skills

<details>
<summary><strong>agents-md</strong> - create or update a repository <code>AGENTS.md</code></summary>

- **Source:** [`skills/agents-md/`](skills/agents-md/)
- **Use:** Bootstrap an `AGENTS.md` or check one for stale claims.

</details>

<details>
<summary><strong>architecture-review</strong> - find codebase architecture problems</summary>

- **Source:** [`skills/architecture-review/`](skills/architecture-review/)
- **Use:** Create a visual HTML report and explore a selected problem.

</details>

<details>
<summary><strong>create-skills</strong> - write agent documents and skills</summary>

- **Source:** [`skills/create-skills/`](skills/create-skills/)
- **Use:** Apply the included rules and references when you write agent documents.

</details>

<details>
<summary><strong>grilling</strong> - stress-test a plan or decision</summary>

- **Source:** [`skills/grilling/`](skills/grilling/)
- **Use:** Question the user until the plan or decision is clear.
- **Credit:** Original skill by [Matt Pocock](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md).

</details>

<details>
<summary><strong>handoff</strong> - create a handoff for another agent</summary>

- **Source:** [`skills/handoff/`](skills/handoff/)
- **Use:** Compact the current conversation into a handoff document.

</details>

<details>
<summary><strong>huh</strong> - explain the last answer again</summary>

- **Source:** [`skills/huh/`](skills/huh/)
- **Use:** Give a clearer and simpler explanation of the last answer.

</details>

<details>
<summary><strong>nixbot-check</strong> - triage nixbot CI</summary>

- **Source:** [`skills/nixbot-check/`](skills/nixbot-check/)
- **Use:** Find, classify, reproduce, and monitor nixbot failures with `nbo`.

</details>

<details>
<summary><strong>ops-review</strong> - find infrastructure operation risks</summary>

- **Source:** [`skills/ops-review/`](skills/ops-review/)
- **Use:** Create a visual HTML report and examine a selected risk.

</details>

<details>
<summary><strong>osm</strong> - query OpenStreetMap</summary>

- **Source:** [`skills/osm/`](skills/osm/)
- **CLI:** `osm`
- **Requirement:** Configure `OSM_NOMINATIM_URL` for geocoding.
- **Use:** Find places, nearby points of interest, and public transport stops with bounded normalized output.

</details>

<details>
<summary><strong>paperless</strong> - search and browse paperless-ngx</summary>

- **Source:** [`skills/paperless/`](skills/paperless/)
- **CLI:** `paperless`
- **Requirement:** `PAPERLESS_URL` and `PAPERLESS_API_TOKEN`
- **Use:** Search and read documents, receipts, invoices, and scans through a bounded read-only interface.

</details>

<details>
<summary><strong>review-pong</strong> - challenge code review findings</summary>

- **Source:** [`skills/review-pong/`](skills/review-pong/)
- **Use:** Ask a second model to challenge findings until the verdicts are stable.

</details>

<details>
<summary><strong>teach</strong> - teach a skill or concept</summary>

- **Source:** [`skills/teach/`](skills/teach/)
- **Use:** Teach the user in the current workspace.

</details>

### Prompts

| name          | purpose                       |
| ------------- | ----------------------------- |
| `commit.md`   | commit current work with jj   |
| `jjcommit.md` | atomic jj commit workflow     |
| `publish.md`  | publish committed work safely |

### Themes

<details>
<summary><strong>grey-amber.json</strong> - dark grey theme with amber accents</summary>

- **Source:** [`themes/grey-amber.json`](themes/grey-amber.json)
- **Name:** `grey-amber`

</details>

<details>
<summary><strong>grey-teal.json</strong> - dark grey theme with teal accents</summary>

- **Source:** [`themes/grey-teal.json`](themes/grey-teal.json)
- **Name:** `grey-teal`

</details>

### Extensions

<details>
<summary><strong>btw</strong> - run a side conversation</summary>

- **Source:** [`extensions/btw/`](extensions/btw/)
- **Commands:** `/btw`, `/btw:tangent`, `/btw:new`, `/btw:clear`, `/btw:inject`, `/btw:summarize`, `/btw:model`, and `/btw:thinking`
- **Use:** Ask side questions without adding each turn to the main conversation.

</details>

<details>
<summary><strong>clipboard</strong> - copy text to the system clipboard</summary>

- **Source:** [`extensions/clipboard/`](extensions/clipboard/)
- **Tool:** `copy_to_clipboard`
- **Use:** Copy generated text through OSC52.

</details>

<details>
<summary><strong>llm-wiki</strong> - synchronize and update a Git-backed LLM wiki</summary>

- **Source:** [`extensions/llm-wiki/`](extensions/llm-wiki/)
- **Tool:** `llm_wiki`
- **Actions:** `status`, `search`, `read`, and `apply`
- **Commands:** `/wiki-capture`, `/wiki-query`, `/wiki-observe`, `/wiki-lint`, and `/wiki-status`
- **Requirement:** `git` in `PATH`
- **Use:** Safely operate an existing Git-backed wiki without GitHub APIs.

The extension embeds the Karpathy LLM Wiki pattern and the OKF v0.2 document baseline. It requires a Git repository named `llm-wiki` with top-level `raw/` and `wiki/` directories. `SPEC.md`, `AGENTS.md`, and other supported schema files are optional. The extension reports each available schema file for the agent to read before semantic work.

</details>

<details>
<summary><strong>sediment-memory</strong> - extract and recall long-term memories</summary>

- **Source:** [`extensions/sediment-memory/`](extensions/sediment-memory/)
- **Command:** `/memory`
- **Tool:** `memory_search`
- **Requirement:** `sediment` in `PATH`
- **Nix package:** `packages.<system>.sediment`

</details>

<details>
<summary><strong>oracle</strong> - ask another model for a second opinion</summary>

- **Source:** [`extensions/oracle/`](extensions/oracle/)
- **Command:** `/oracle`
- **Tool:** `second_opinion`

</details>

<details>
<summary><strong>pi-to-PI</strong> - rewrite <code>pi</code> for Anthropic models</summary>

- **Source:** [`extensions/pi-to-PI/`](extensions/pi-to-PI/)
- **Use:** Rewrite standalone `pi` to `PI` in the system prompt for Anthropic models.

</details>

<details>
<summary><strong>sketch/</strong> - draw image input in a browser</summary>

- **Source:** [`extensions/sketch/`](extensions/sketch/)
- **Command:** `/sketch`
- **Use:** Open a browser sketch pad and send the result as image input.

</details>

## Nix outputs

```bash
nix build .#
nix fmt
nix flake check
```

outputs:

- `packages.<system>.default` — packaged pi assets under `share/pi-pack/`
- `packages.<system>.sediment` — patched Sediment package for `sediment-memory`
- `packages.<system>.osm-cli` — OpenStreetMap CLI for the `osm` skill
- `packages.<system>.paperless-cli` — read-only Paperless-ngx CLI for the `paperless` skill
- `checks.<system>.extension-tests` — mocked extension load and unit tests
- `checks.<system>.pi-compatibility` — real extension load with Pi from `llm-agents.nix`
- `homeModules.default` — Home Manager resource and Sediment deployment
- `formatter.<system>` — treefmt wrapper
- `lib.skills`, `lib.prompts`, `lib.extensions`, `lib.themes` — discovered asset names

## Security

extensions execute code in the agent process. review them before installing from git.

`llm-wiki` commits and pushes successful mutation operations. It stops on dirty state, divergence, stale content, validation errors, locks, and push rejection.

skills can instruct an agent to run commands. review them before enabling in unattended services.

## License

MIT
