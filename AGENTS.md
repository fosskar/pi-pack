# pi-pack

## overview

pi-pack distributes Pi extensions, skills, prompt templates, and themes. Nix packages the resources and deploys selected resources through Home Manager. Pi can also install the repository as a conventional git package.

## layout

- `extensions/<name>/index.ts`: TypeScript extension entry points.
- `extensions/<name>/README.md`: extension interface, configuration, lifecycle, and safety notes.
- `extensions/<name>/test/<name>.test.ts`: colocated extension tests.
- `skills/<name>/SKILL.md`: skill frontmatter and instructions. Keep referenced support files in the same skill directory.
- `prompts/*.md`: prompt templates. The filename becomes the slash command.
- `themes/*.json`: complete Pi theme definitions.
- `flake.nix`: resource discovery, package outputs, checks, and formatter configuration.
- `nix/home-manager.nix`: `programs.pi-pack` options, resource links, and required packages.
- `nix/test/`: Bun preload mocks, shared test helpers, and the explicit test runner.
- `nix/packages/sediment/`: patched Sediment package for `sediment-memory`.

## resource flow

`flake.nix` discovers non-hidden resource names from the four resource directories. It exports these names through `lib` and passes them to `nix/home-manager.nix`.

The Home Manager module links selected resources into `.pi/agent/{extensions,skills,prompts,themes}`. It also adds resource-specific CLI packages to `home.packages`.

The default package copies `README.md`, `LICENSE`, and all resource directories to `$out/share/pi-pack`.

## development commands

Run all commands from the repository root.

```bash
nix build .#
nix flake check
nix fmt
```

`nix flake check` runs package builds, Home Manager evaluations, formatting, mocked extension tests, and a real Pi load test.

The extension test check runs:

```bash
bun --preload ./nix/test/preload.ts ./nix/test/run.ts
```

Use `nix flake check` as the normal test entry point because the repository has no development shell or JavaScript package manifest.

## extension conventions

- Export a default factory that receives `ExtensionAPI`.
- Use `typebox` schemas for tool parameters.
- Keep tool names, command names, custom message types, and persisted entry types stable.
- Guard TUI-only behavior with the Pi run mode.
- Start long-lived resources on session use, not in the extension factory. Close them in `session_shutdown`.
- Throw from a tool `execute` function to return a failed tool result.
- Limit tool output before it enters model context.
- Preserve cancellation signals for model calls, process calls, and network calls.
- Reconstruct persistent state from session entries when an extension reloads.
- Keep each extension README accurate when its interface, configuration, lifecycle, or safety behavior changes.

Match the existing extension before adding an abstraction. `btw` and `sediment-memory` contain stateful examples. `clipboard` and `pi-to-PI` contain minimal examples.

## test conventions

Each extension test exports one default function. `nix/test/run.ts` imports and calls every test explicitly. Add a new import and call when you add an extension test.

Use `createMockPi()` from `nix/test/helpers.ts` to inspect registered events, commands, tools, shortcuts, renderers, entries, and messages. Add shared runtime module stubs to `nix/test/preload.ts`.

The `pi-compatibility` check loads every `extensions/*/index.ts` with a real offline Pi RPC process. Keep each extension loadable without network access or credentials.

## skill, prompt, and theme conventions

Skill directories use kebab-case. Each `SKILL.md` starts with `name` and `description` frontmatter. Use `disable-model-invocation: true` only for skills that require explicit user invocation. Resolve support file links relative to the skill directory.

Prompt templates use Markdown with `description` frontmatter. Use `argument-hint` when the prompt accepts arguments. Keep positional argument syntax compatible with Pi prompt templates.

Theme files contain a unique `name`, reusable `vars`, and the complete Pi `colors` map. Keep the `$schema` field. Validate both theme files through the `pi-compatibility` check.

## nix conventions

Keep resource discovery and Home Manager enum values connected. If a resource requires a CLI package, add the package mapping in `nix/home-manager.nix` and add an integration assertion when useful.

Use existing flake inputs and package outputs. Do not add a JavaScript dependency only to run extensions; Pi provides its core extension packages at runtime.

Run `nix fmt` after Nix, TypeScript, Markdown, or JSON changes. The formatter uses nixfmt, Prettier, deadnix, and statix.

## important constraints

Extensions run in the Pi process with user permissions. Skills can direct an agent to execute commands. Do not weaken the security notes in `README.md`.

`sediment-memory` requires `sediment` in `PATH`. The Home Manager selection must install or remove both together.

The checks support `x86_64-linux`, `aarch64-linux`, and `aarch64-darwin`.
