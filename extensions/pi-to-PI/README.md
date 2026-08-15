# pi-to-PI

Rewrite standalone lowercase `pi` to `PI` in the system prompt for Anthropic models.

## Behavior

The extension runs before each agent starts. It changes the system prompt only when the selected provider is `anthropic`.

It rewrites standalone uses such as:

```text
Use pi to inspect the project.
```

It preserves uses inside paths and identifiers, including:

```text
~/.pi/
pi-coding-agent
```

The extension does not change user messages, assistant messages, tool results, files, or prompts sent to non-Anthropic providers.

## Configuration

The extension has no commands, tools, environment variables, or persistent state.
