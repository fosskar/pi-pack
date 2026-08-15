import assert from "node:assert/strict";
import extension from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

export default async function (): Promise<void> {
  const mock = createMockPi();
  extension(mock.pi as never);
  const handler = mock.events.get("before_agent_start")?.[0];
  assert.ok(handler);

  const anthropic = await handler(
    { systemPrompt: "pi ~/.pi/ pi-coding-agent pi, pi." },
    { model: { provider: "anthropic" } },
  );
  assert.deepEqual(anthropic, {
    systemPrompt: "PI ~/.pi/ pi-coding-agent PI, PI.",
  });
  assert.equal(
    await handler({ systemPrompt: "pi" }, { model: { provider: "google" } }),
    undefined,
  );
}
