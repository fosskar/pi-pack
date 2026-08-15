# pi-pack

shareable pi assets: skills, prompt templates, and extensions.

## install with pi

```bash
pi install git:git@github.com:fosskar/pi-pack.git
```

or in `~/.pi/agent/settings.json`:

```json
{
  "packages": ["git:git@github.com:fosskar/pi-pack.git"]
}
```

pi loads:

- `skills/`
- `prompts/`
- `extensions/`
- `themes/`

`sediment-memory.ts` requires the patched Sediment package in `PATH`. Nix users can install it with `nix profile install github:fosskar/pi-pack#sediment`.

## use as nix flake source

```nix
{
  inputs.pi-pack.url = "github:fosskar/pi-pack";
}
```

for pi via home-manager:

```nix
{
  imports = [ inputs.pi-pack.homeModules.default ];
  programs.pi-pack.enable = true;
}
```

The module deploys the resources under `~/.pi/agent/`. The `extensions` and `skills` options default to all available resources. Resource dependencies follow those selections, so Sediment is installed only when `sediment-memory.ts` is selected. The module does not install pi.

for services that need one skill path:

```nix
{
  services.opencrow.skills.osm = "${inputs.pi-pack}/skills/osm";
}
```

## contents

### skills

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

### prompts

| name          | purpose                       |
| ------------- | ----------------------------- |
| `commit.md`   | commit current work with jj   |
| `jjcommit.md` | atomic jj commit workflow     |
| `publish.md`  | publish committed work safely |

### themes

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

### extensions

<details>
<summary><strong>btw.ts</strong> - run a side conversation</summary>

- **Source:** [`extensions/btw.ts`](extensions/btw.ts)
- **Commands:** `/btw`, `/btw:tangent`, `/btw:new`, `/btw:clear`, `/btw:inject`, `/btw:summarize`, `/btw:model`, and `/btw:thinking`
- **Use:** Ask side questions without adding each turn to the main conversation.

</details>

<details>
<summary><strong>clipboard.ts</strong> - copy text to the system clipboard</summary>

- **Source:** [`extensions/clipboard.ts`](extensions/clipboard.ts)
- **Tool:** `copy_to_clipboard`
- **Use:** Copy generated text through OSC52.

</details>

<details>
<summary><strong>sediment-memory.ts</strong> - extract and recall long-term memories</summary>

- **Source:** [`extensions/sediment-memory.ts`](extensions/sediment-memory.ts)
- **Command:** `/memory`
- **Tool:** `memory_search`
- **Requirement:** `sediment` in `PATH`
- **Nix package:** `packages.<system>.sediment`

</details>

<details>
<summary><strong>oracle.ts</strong> - ask another model for a second opinion</summary>

- **Source:** [`extensions/oracle.ts`](extensions/oracle.ts)
- **Command:** `/oracle`
- **Tool:** `second_opinion`

</details>

<details>
<summary><strong>pi-to-PI.ts</strong> - rewrite <code>pi</code> for Anthropic models</summary>

- **Source:** [`extensions/pi-to-PI.ts`](extensions/pi-to-PI.ts)
- **Use:** Rewrite standalone `pi` to `PI` in the system prompt for Anthropic models.

</details>

<details>
<summary><strong>sketch/</strong> - draw image input in a browser</summary>

- **Source:** [`extensions/sketch/`](extensions/sketch/)
- **Command:** `/sketch`
- **Use:** Open a browser sketch pad and send the result as image input.

</details>

## nix outputs

```bash
nix build .#
nix fmt
nix flake check
```

outputs:

- `packages.<system>.default` — packaged pi assets under `share/pi-pack/`
- `packages.<system>.sediment` — patched Sediment package for `sediment-memory.ts`
- `checks.<system>.extension-tests` — mocked extension load and unit tests
- `checks.<system>.pi-compatibility` — real extension load with Pi from `llm-agents.nix`
- `homeModules.default` — Home Manager resource and Sediment deployment
- `formatter.<system>` — treefmt wrapper
- `lib.skills`, `lib.prompts`, `lib.extensions`, `lib.themes` — discovered asset names

## security

extensions execute code in the agent process. review them before installing from git.

skills can instruct an agent to run commands. review them before enabling in unattended services.

## license

MIT
