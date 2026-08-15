# sketch

Draw an image in a browser and attach it to the next Pi message.

## Command

```text
/sketch
```

The command requires interactive mode. It:

1. Starts a temporary HTTP server on a random `127.0.0.1` port.
2. Opens `sketch.html` in the default browser.
3. Waits for the browser to submit or cancel the sketch.
4. Keeps the submitted PNG in memory.
5. Attaches the PNG to the next user message.

The editor receives this default prompt after submission:

```text
describe what's in this sketch:
```

Change the prompt before sending when necessary.

## Browser support

The extension uses:

- `open` on macOS.
- `start` on Windows.
- `xdg-open` or `sensible-browser` on Linux.

The browser page provides the drawing controls and sends a Base64 PNG back to Pi.

## Lifecycle and safety

- The server listens only on `127.0.0.1`.
- The server closes after submit, cancel, or ten minutes.
- Escape or Ctrl+C cancels the active sketch dialog.
- Session shutdown removes an unsent image from memory.
- The extension does not write the image to disk.
- Only one submitted sketch can wait for the next user message.
