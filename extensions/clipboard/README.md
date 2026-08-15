# clipboard

Copy generated text to the system clipboard through OSC52.

## Tool

The extension registers `copy_to_clipboard`:

```json
{
  "text": "Text to copy"
}
```

The tool UTF-8 encodes the text, converts it to Base64, and writes one OSC52 escape sequence to standard output. It does not call a platform clipboard program.

## Requirements

The terminal and any terminal multiplexer must permit OSC52 clipboard writes. Clipboard behavior depends on the terminal configuration. The extension cannot verify that the terminal accepted the payload.

## Limits

- The extension writes only to the clipboard. It cannot read clipboard content.
- The terminal receives the complete encoded text.
- Terminal payload limits can truncate large values.
- The tool reports the submitted character count, not clipboard verification.
