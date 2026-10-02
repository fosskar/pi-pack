# herdr-session-name

Show the pi session name as the agent name of the pi pane in Herdr.

## Behavior

Herdr labels a pane that runs pi as `pi` in the sidebar `agent` row and, with `ui.show_agent_labels_on_pane_borders`, on the pane border. The extension replaces that label with `π <session name>`. A session without a name uses `π <cwd basename>`, matching the terminal title pi sets.

The extension sends `pane.report_metadata` with `display_agent` to the Herdr socket:

- on `session_start`, including session replacement
- on `session_info_changed`, which `/name`, `--name`, and `pi.setSessionName()` emit

Each report carries `agent: "pi"`, so Herdr shows the label only while pi is the detected agent in the pane. After pi exits, the pane falls back to its normal label.

## Requirements

The extension is active only when `HERDR_ENV=1`, `HERDR_SOCKET_PATH`, and `HERDR_PANE_ID` are set, which Herdr does for every pane it manages. It reports only in interactive mode; RPC, JSON, and print runs do not change the label.

A failed report, such as an unreachable socket or an unknown pane, surfaces as an extension error. The extension does not retry.

## Configuration

The extension has no commands, tools, configuration, or persistent state.
