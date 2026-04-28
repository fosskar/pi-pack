# pi-pack

shareable pi assets: skills, prompt templates, and extensions.

## install with pi

```bash
pi install git:git@codeberg.org:fosskar/pi-pack.git
```

or in `~/.pi/agent/settings.json`:

```json
{
  "packages": ["git:git@codeberg.org:fosskar/pi-pack.git"]
}
```

pi loads:

- `skills/`
- `prompts/`
- `extensions/`

## use as nix flake source

```nix
{
  inputs.pi-pack.url = "git+ssh://git@codeberg.org/fosskar/pi-pack.git";
}
```

for pi via home-manager:

```nix
{
  home.file = {
    ".pi/agent/skills".source = "${inputs.pi-pack}/skills";
    ".pi/agent/prompts".source = "${inputs.pi-pack}/prompts";
    ".pi/agent/extensions".source = "${inputs.pi-pack}/extensions";
  };
}
```

for services that need one skill path:

```nix
{
  services.opencrow.skills.osm = "${inputs.pi-pack}/skills/osm";
}
```

## contents

### skills

| name        | purpose                                                     |
| ----------- | ----------------------------------------------------------- |
| `batch`     | decompose and coordinate large codebase changes             |
| `caveman`   | answer tersely without dropping technical content           |
| `grill-me`  | interrogate a plan one question at a time                   |
| `jujutsu`   | reference workflow for jj                                   |
| `osm`       | query OpenStreetMap / Nominatim / Overpass                  |
| `paperless` | read-only paperless-ngx search and browsing                 |
| `simplify`  | review code for reuse, quality, and efficiency, then fix it |

### prompts

| name          | purpose                       |
| ------------- | ----------------------------- |
| `commit.md`   | commit current work with jj   |
| `jjcommit.md` | atomic jj commit workflow     |
| `publish.md`  | publish committed work safely |

### extensions

| name            | purpose                                       |
| --------------- | --------------------------------------------- |
| `btw.ts`        | ask current model a side question             |
| `clipboard.ts`  | copy text via OSC52                           |
| `diff.ts`       | open changed files in editor diff view        |
| `oracle.ts`     | ask another configured model for review       |
| `pi-pong.ts`    | run two models on a task until convergence    |
| `pi-to-PI.ts`   | rewrite standalone `pi` to `PI` for Anthropic |
| `safety-net.ts` | block or confirm dangerous tool calls         |
| `sketch/`       | browser sketch pad for image input            |

## nix outputs

```bash
nix build .#
nix fmt
nix flake check
```

outputs:

- `packages.<system>.default` — packaged pi assets under `share/pi-pack/`
- `formatter.<system>` — treefmt wrapper
- `lib.skills`, `lib.prompts`, `lib.extensions` — discovered asset names

## security

extensions execute code in the agent process. review them before installing from git.

skills can instruct an agent to run commands. review them before enabling in unattended services.

## license

MIT
