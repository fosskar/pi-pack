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

| skill                                              | description                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [agents-md](skills/agents-md/)                     | Bootstrap an `AGENTS.md` or check one for stale claims.                                                                                                                         |
| [architecture-review](skills/architecture-review/) | Create a visual HTML report and explore a selected codebase architecture problem.                                                                                               |
| [create-skills](skills/create-skills/)             | Apply the included rules and references when you write agent documents.                                                                                                         |
| [grilling](skills/grilling/)                       | Question the user until the plan or decision is clear. Original skill by [Matt Pocock](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md).   |
| [handoff](skills/handoff/)                         | Compact the current conversation into a handoff document.                                                                                                                       |
| [huh](skills/huh/)                                 | Give a clearer and simpler explanation of the last answer.                                                                                                                      |
| [nixbot-check](skills/nixbot-check/)               | Find, classify, reproduce, and monitor nixbot failures. Requires `nbo` from the `nixbot-cli` package, and `NIXBOT_URL` for a self-hosted instance. pi-pack does not install it. |
| [ops-review](skills/ops-review/)                   | Create a visual HTML report and examine a selected infrastructure risk.                                                                                                         |
| [osm](skills/osm/)                                 | Find places, nearby points of interest, and public transport stops.                                                                                                             |
| [paperless](skills/paperless/)                     | Search and read documents, receipts, invoices, and scans through a bounded read-only interface. Requires a paperless-ngx instance, `PAPERLESS_URL`, and `PAPERLESS_API_TOKEN`.  |
| [review-pong](skills/review-pong/)                 | Ask a second model to challenge review findings until the verdicts are stable.                                                                                                  |
| [teach](skills/teach/)                             | Teach the user a skill or concept in the current workspace.                                                                                                                     |

### Prompts

| prompt                        | description                                                                                       | commands            |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| [commit](prompts/commit.md)   | Split the current work into atomic commits with jj. It does not move bookmarks and does not push. | `/commit`           |
| [publish](prompts/publish.md) | Rebase on `origin` and push `main` to a remote.                                                   | `/publish [remote]` |

### Themes

| theme                                | description                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| [grey-amber](themes/grey-amber.json) | A dark grey theme with amber accents. Set `"theme": "grey-amber"` in `settings.json`. |
| [grey-teal](themes/grey-teal.json)   | A dark grey theme with teal accents. Set `"theme": "grey-teal"` in `settings.json`.   |

### Extensions

| extension                                      | description                                                                                                                                                                                    | commands                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [btw](extensions/btw/)                         | Ask side questions without adding each turn to the main conversation.                                                                                                                          | `/btw` and seven subcommands                                                  |
| [clipboard](extensions/clipboard/)             | Copy generated text through OSC52. Requires a terminal that accepts OSC52 clipboard writes.                                                                                                    |                                                                               |
| [llm-wiki](extensions/llm-wiki/)               | Safely operate an existing Git-backed wiki without GitHub APIs. Requires `git` in `PATH` and a Git repository named `llm-wiki`. pi-pack does not create it.                                    | `/wiki-capture`, `/wiki-query`, `/wiki-observe`, `/wiki-lint`, `/wiki-status` |
| [oracle](extensions/oracle/)                   | Ask a second model to review, critique, or challenge a conclusion. Requires a second configured model provider.                                                                                | `/oracle`                                                                     |
| [pi-to-PI](extensions/pi-to-PI/)               | Rewrite standalone `pi` to `PI` in the system prompt for Anthropic models.                                                                                                                     |                                                                               |
| [sediment-memory](extensions/sediment-memory/) | Keep durable facts across sessions and recall them later. Requires `sediment` in `PATH`; Home Manager installs it, other Nix setups run `nix profile install github:fosskar/pi-pack#sediment`. | `/memory`                                                                     |
| [sketch](extensions/sketch/)                   | Open a browser sketch pad and send the result as image input. Requires a browser on the machine that runs Pi.                                                                                  | `/sketch`                                                                     |

## Develop

```bash
nix build .#     # packaged resources under share/pi-pack/
nix fmt          # nixfmt, Prettier, deadnix, statix
nix flake check  # builds, module evaluation, formatting, extension tests
```

Run `nix flake show` for the full output list.

## Security

extensions execute code in the agent process. review them before installing from git.

skills can instruct an agent to run commands. review them before enabling in unattended services.

## License

MIT
