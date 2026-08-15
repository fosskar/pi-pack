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
- **Use:** Find places, nearby points of interest, and public transport stops.

</details>

<details>
<summary><strong>paperless</strong> - search and browse paperless-ngx</summary>

- **Source:** [`skills/paperless/`](skills/paperless/)
- **Use:** Find documents, receipts, invoices, and scans.

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

- **Source:** [`extensions/btw/index.ts`](extensions/btw/index.ts)
- **Commands:** `/btw`, `/btw:tangent`, `/btw:new`, `/btw:clear`, `/btw:inject`, `/btw:summarize`, `/btw:model`, and `/btw:thinking`
- **Use:** Ask side questions without adding each turn to the main conversation.

</details>

<details>
<summary><strong>clipboard</strong> - copy text to the system clipboard</summary>

- **Source:** [`extensions/clipboard/index.ts`](extensions/clipboard/index.ts)
- **Tool:** `copy_to_clipboard`
- **Use:** Copy generated text through OSC52.

</details>

<details>
<summary><strong>sediment-memory</strong> - extract and recall long-term memories</summary>

- **Source:** [`extensions/sediment-memory/index.ts`](extensions/sediment-memory/index.ts)
- **Command:** `/memory`
- **Tool:** `memory_search`
- **Requirement:** `sediment` in `PATH`
- **Nix package:** `packages.<system>.sediment`

</details>

<details>
<summary><strong>oracle</strong> - ask another model for a second opinion</summary>

- **Source:** [`extensions/oracle/index.ts`](extensions/oracle/index.ts)
- **Command:** `/oracle`
- **Tool:** `second_opinion`

</details>

<details>
<summary><strong>pi-to-PI</strong> - rewrite <code>pi</code> for Anthropic models</summary>

- **Source:** [`extensions/pi-to-PI/index.ts`](extensions/pi-to-PI/index.ts)
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
- `checks.<system>.extension-tests` — mocked extension load and unit tests
- `checks.<system>.pi-compatibility` — real extension load with Pi from `llm-agents.nix`
- `homeModules.default` — Home Manager resource and Sediment deployment
- `formatter.<system>` — treefmt wrapper
- `lib.skills`, `lib.prompts`, `lib.extensions`, `lib.themes` — discovered asset names

## Security

extensions execute code in the agent process. review them before installing from git.

skills can instruct an agent to run commands. review them before enabling in unattended services.

## License

MIT
