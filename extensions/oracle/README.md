# oracle

Ask another configured model for a second opinion.

The extension provides an agent tool and an interactive command. Both exclude the current model and use a short system prompt for independent critique.

## Tool

The `second_opinion` tool accepts:

- `prompt`: A self-contained question or brief.
- `model`: An optional model ID or name substring.
- `files`: Optional file paths to include as UTF-8 text.
- `include_context`: Include recent conversation context. The default is `false`.

Without `model`, the tool selects the first available alternative model. The result returns directly to the calling agent.

Write a self-contained `prompt` unless the task requires conversation context. Included data is sent to the selected model provider.

## Command

```text
/oracle [-m MODEL] [-f FILE]... PROMPT
```

Examples:

```text
/oracle challenge this design
/oracle -m gpt-4o challenge this design
/oracle -f src/index.ts -f src/types.ts review this interface
```

Without `-m`, the command opens a model picker. The command always includes recent conversation context. It then shows the response and asks whether to add it to the main session context.

The command requires interactive mode.

## Model selection

The extension uses models available through the Pi model registry. The selected model needs configured credentials. Model queries match an exact ID, an ID substring, or a case-insensitive display-name substring.

## Context and files

- Conversation context is limited to the latest 40 messages and 100,000 characters.
- Tool-result text in serialized context is limited to 2,000 characters per result.
- File paths resolve from the Pi working directory. Absolute paths are also accepted.
- File read errors become visible text in the second-model prompt.
- Included files have no separate size limit.

Do not include secrets or private files unless the selected provider may receive them.
