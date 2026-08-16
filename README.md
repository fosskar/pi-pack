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

The `llm-wiki` and `sediment-memory` extensions need extra CLI tools. See their entries under [Extensions](#extensions).

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
<summary><strong>agents-md</strong></summary>

- **Source:** [`skills/agents-md/`](skills/agents-md/)
- **Use:** Bootstrap an `AGENTS.md` or check one for stale claims.

</details>

<details>
<summary><strong>architecture-review</strong></summary>

- **Source:** [`skills/architecture-review/`](skills/architecture-review/)
- **Use:** Create a visual HTML report and explore a selected problem.

</details>

<details>
<summary><strong>create-skills</strong></summary>

- **Source:** [`skills/create-skills/`](skills/create-skills/)
- **Use:** Apply the included rules and references when you write agent documents.

</details>

<details>
<summary><strong>grilling</strong></summary>

- **Source:** [`skills/grilling/`](skills/grilling/)
- **Use:** Question the user until the plan or decision is clear.
- **Credit:** Original skill by [Matt Pocock](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md).

</details>

<details>
<summary><strong>handoff</strong></summary>

- **Source:** [`skills/handoff/`](skills/handoff/)
- **Use:** Compact the current conversation into a handoff document.

</details>

<details>
<summary><strong>huh</strong></summary>

- **Source:** [`skills/huh/`](skills/huh/)
- **Use:** Give a clearer and simpler explanation of the last answer.

</details>

<details>
<summary><strong>nixbot-check</strong></summary>

- **Source:** [`skills/nixbot-check/`](skills/nixbot-check/)
- **Use:** Find, classify, reproduce, and monitor nixbot failures.
- **Requires:** `nbo` from the `nixbot-cli` package, and `NIXBOT_URL` for a self-hosted instance. pi-pack does not install it.

</details>

<details>
<summary><strong>ops-review</strong></summary>

- **Source:** [`skills/ops-review/`](skills/ops-review/)
- **Use:** Create a visual HTML report and examine a selected risk.

</details>

<details>
<summary><strong>osm</strong></summary>

- **Source:** [`skills/osm/`](skills/osm/)
- **Use:** Find places, nearby points of interest, and public transport stops with bounded normalized output.

</details>

<details>
<summary><strong>paperless</strong></summary>

- **Source:** [`skills/paperless/`](skills/paperless/)
- **Use:** Search and read documents, receipts, invoices, and scans through a bounded read-only interface.
- **Requires:** A paperless-ngx instance, `PAPERLESS_URL`, and `PAPERLESS_API_TOKEN`.

</details>

<details>
<summary><strong>review-pong</strong></summary>

- **Source:** [`skills/review-pong/`](skills/review-pong/)
- **Use:** Ask a second model to challenge findings until the verdicts are stable.

</details>

<details>
<summary><strong>teach</strong></summary>

- **Source:** [`skills/teach/`](skills/teach/)
- **Use:** Teach the user a skill or concept in the current workspace.

</details>

### Prompts

| name         | purpose                       |
| ------------ | ----------------------------- |
| `commit.md`  | commit current work with jj   |
| `publish.md` | publish committed work safely |

### Themes

<details>
<summary><strong>grey-amber.json</strong></summary>

- **Source:** [`themes/grey-amber.json`](themes/grey-amber.json)
- **Use:** A dark grey theme with amber accents. Set `"theme": "grey-amber"` in `settings.json`.

</details>

<details>
<summary><strong>grey-teal.json</strong></summary>

- **Source:** [`themes/grey-teal.json`](themes/grey-teal.json)
- **Use:** A dark grey theme with teal accents. Set `"theme": "grey-teal"` in `settings.json`.

</details>

### Extensions

<details>
<summary><strong>btw</strong></summary>

- **Source:** [`extensions/btw/`](extensions/btw/)
- **Use:** Ask side questions without adding each turn to the main conversation.
- **Commands:** `/btw`, `/btw:tangent`, `/btw:new`, `/btw:clear`, `/btw:inject`, `/btw:summarize`, `/btw:model`, and `/btw:thinking`

</details>

<details>
<summary><strong>clipboard</strong></summary>

- **Source:** [`extensions/clipboard/`](extensions/clipboard/)
- **Use:** Copy generated text through OSC52.
- **Requires:** A terminal that accepts OSC52 clipboard writes.

</details>

<details>
<summary><strong>llm-wiki</strong></summary>

- **Source:** [`extensions/llm-wiki/`](extensions/llm-wiki/)
- **Use:** Safely operate an existing Git-backed wiki without GitHub APIs.
- **Commands:** `/wiki-capture`, `/wiki-query`, `/wiki-observe`, `/wiki-lint`, and `/wiki-status`
- **Requires:** `git` in `PATH`, and a Git repository named `llm-wiki`. pi-pack does not create it.

The extension embeds the Karpathy LLM Wiki pattern and the OKF v0.2 document baseline. It requires a Git repository named `llm-wiki` with top-level `raw/` and `wiki/` directories. `SPEC.md`, `AGENTS.md`, and other supported schema files are optional. The extension reports each available schema file for the agent to read before semantic work.

The extension searches the working directory and its parents for the repository. [`extensions/llm-wiki/README.md`](extensions/llm-wiki/README.md) describes discovery and the `LLM_WIKI_PATH`, `LLM_WIKI_BRANCH`, and `LLM_WIKI_REMOTE` overrides.

</details>

<details>
<summary><strong>sediment-memory</strong></summary>

- **Source:** [`extensions/sediment-memory/`](extensions/sediment-memory/)
- **Use:** Keep durable facts across sessions and recall them later.
- **Commands:** `/memory`
- **Requires:** `sediment` in `PATH`. Home Manager installs it. Other Nix setups install it separately.

```bash
nix profile install github:fosskar/pi-pack#sediment
```

[`extensions/sediment-memory/README.md`](extensions/sediment-memory/README.md) describes the `SEDIMENT_BIN` and `SEDIMENT_DB` overrides and the database location.

</details>

<details>
<summary><strong>oracle</strong></summary>

- **Source:** [`extensions/oracle/`](extensions/oracle/)
- **Use:** Ask a second model to review, critique, or challenge a conclusion.
- **Commands:** `/oracle`
- **Requires:** A second configured model provider.

</details>

<details>
<summary><strong>pi-to-PI</strong></summary>

- **Source:** [`extensions/pi-to-PI/`](extensions/pi-to-PI/)
- **Use:** Rewrite standalone `pi` to `PI` in the system prompt for Anthropic models.

</details>

<details>
<summary><strong>sketch</strong></summary>

- **Source:** [`extensions/sketch/`](extensions/sketch/)
- **Use:** Open a browser sketch pad and send the result as image input.
- **Commands:** `/sketch`
- **Requires:** A browser on the machine that runs Pi.

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
