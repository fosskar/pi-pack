# pi-pack

skills, extensions, and prompts for [pi](https://github.com/badlogic/pi-mono) coding agent.

## install

```bash
pi install git:github.com/fosskar/pi-pack
```

or add to `settings.json`:

```json
{ "packages": ["git:github.com/fosskar/pi-pack"] }
```

## skills

| skill | description |
|-------|-------------|
| `/skill:simplify` | review changed code for reuse, quality, and efficiency, then fix issues. pass optional text to focus on specific concerns |
| `/skill:batch` | orchestrate large-scale parallel changes across a codebase. decomposes work into independent units with a plan-then-execute flow |

## structure

```
skills/       — agent skills (SKILL.md)
extensions/   — typescript extensions
prompts/      — prompt templates
themes/       — color themes
```

## license

MIT
