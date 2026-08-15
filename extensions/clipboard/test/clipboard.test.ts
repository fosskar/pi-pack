import assert from "node:assert/strict";
import extension from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

export default async function (): Promise<void> {
  const mock = createMockPi();
  extension(mock.pi as never);
  const tool = mock.tools.get("copy_to_clipboard");
  assert.ok(tool);

  const notifications: unknown[] = [];
  let terminalOutput = "";
  const write = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    terminalOutput += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  try {
    const result = await tool.execute(
      "call-1",
      { text: "copy me" },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { notify: (...args: unknown[]) => notifications.push(args) },
      },
    );
    assert.equal(terminalOutput, "\u001b]52;c;Y29weSBtZQ==\u0007");
    assert.deepEqual(result.content, [
      { type: "text", text: "copied 7 characters to clipboard." },
    ]);
    assert.deepEqual(notifications, [["copied 7 chars to clipboard", "info"]]);
  } finally {
    process.stdout.write = write;
  }
}
