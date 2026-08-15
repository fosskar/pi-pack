import assert from "node:assert/strict";
import extension from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

export default async function (): Promise<void> {
  const mock = createMockPi();
  extension(mock.pi as never);
  const command = mock.commands.get("sketch");
  assert.ok(command);

  const notifications: unknown[] = [];
  await command.handler("", {
    hasUI: false,
    ui: { notify: (...args: unknown[]) => notifications.push(args) },
  });
  assert.deepEqual(notifications, [
    ["sketch requires interactive mode", "error"],
  ]);
}
