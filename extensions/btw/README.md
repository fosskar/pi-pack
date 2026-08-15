# btw

Run a persistent side conversation without adding each turn to the main conversation context.

The extension creates a separate Pi agent session and displays it in a focused overlay. The current side thread persists in the main session tree and returns after session navigation.

## Conversation modes

- **Contextual:** Seeds a new side thread with the current main-session context.
- **Tangent:** Starts without main-session messages.

Changing between these modes starts a fresh side thread.

## Commands

| Command                            | Behavior                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| `/btw [--save] [QUESTION]`         | Open or continue a contextual thread.                        |
| `/btw:tangent [--save] [QUESTION]` | Open or continue a contextless thread.                       |
| `/btw:new [--save] [QUESTION]`     | Clear the current thread and start a contextual thread.      |
| `/btw:clear`                       | Clear the thread and close its interface.                    |
| `/btw:inject [INSTRUCTION]`        | Send the complete thread to the main agent.                  |
| `/btw:summarize [INSTRUCTION]`     | Summarize the thread and send the summary to the main agent. |
| `/btw:model`                       | Show the effective side-thread model.                        |
| `/btw:model PROVIDER MODEL API`    | Set a side-thread model override.                            |
| `/btw:model clear`                 | Remove the model override.                                   |
| `/btw:thinking [LEVEL]`            | Show or set the side-thread thinking level.                  |
| `/btw:thinking clear`              | Remove the thinking override.                                |

`--save` or `-s` also stores a visible BTW note in the main session. Without this option, normal side turns stay out of the main model context.

The extension also registers hyphenated aliases such as `/btw-thread` and `/btw-tangent`. These aliases support runtimes that reserve `/btw` or treat `:` as an argument separator.

## Interface

Use Alt+/ or Ctrl+Alt+W to toggle overlay focus without closing the overlay.

The overlay shows the side thread, model activity, tool activity, token use, model, and thinking level. Commands can also run from the overlay input.

## Model behavior

The side thread uses its model override when that model is available. Otherwise it uses the active main-session model. The thinking override follows the same precedence.

The model override must match a model already available in the Pi model registry. Use Pi login and model configuration before selecting it.

## Handoff

`/btw:inject` and `/btw:summarize` send a new user message to the main agent. A successful handoff clears the side thread. A failed handoff keeps it for retry.

Use injection when the complete reasoning matters. Use summarization when the main agent needs only decisions, findings, risks, or action items.

## Session data

The extension stores side-thread entries, resets, model overrides, and thinking overrides in the Pi session. It filters visible BTW notes from the model context unless a handoff explicitly sends them back.

Session shutdown closes the side agent and the overlay. It does not discard persisted side-thread state.
