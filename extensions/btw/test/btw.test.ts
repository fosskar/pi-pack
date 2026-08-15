import assert from "node:assert/strict";
import extension from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

export default async function (): Promise<void> {
  const mock = createMockPi();
  extension(mock.pi as never);
  const handler = mock.events.get("context")?.[0];
  assert.ok(handler);

  const ordinary = { role: "user", content: "Keep this" };
  const result = await handler({
    messages: [
      ordinary,
      { role: "custom", customType: "btw-note", content: "Hide this" },
    ],
  });
  assert.deepEqual(result.messages, [ordinary]);
}
