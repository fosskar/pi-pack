# pi-to-PI

Rewrite standalone lowercase `pi` to `PI` in the system prompt for Anthropic models.

## Behavior

The extension runs on `before_provider_request`, so it covers every provider request, including turns triggered by custom messages that skip `before_agent_start`. It changes the payload's `system` field only when the selected provider is `anthropic`. A string `system` is rewritten directly; for an array of text blocks, each block's `text` is rewritten and other fields such as `cache_control` are kept.

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
