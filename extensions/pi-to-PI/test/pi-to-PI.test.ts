import assert from "node:assert/strict";
import extension from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

export default async function (): Promise<void> {
  const mock = createMockPi();
  extension(mock.pi as never);
  assert.equal(mock.events.get("before_agent_start"), undefined);
  const handler = mock.events.get("before_provider_request")?.[0];
  assert.ok(handler);
  const anthropic = { model: { provider: "anthropic" } };

  assert.deepEqual(
    await handler(
      {
        payload: {
          model: "claude",
          system: "pi ~/.pi/ pi-coding-agent pi, pi.",
        },
      },
      anthropic,
    ),
    { model: "claude", system: "PI ~/.pi/ pi-coding-agent PI, PI." },
  );

  // a turn triggered by sendCustomMessage never emits before_agent_start,
  // so the provider payload must carry the rewrite on its own
  const triggered = {
    model: "claude",
    messages: [{ role: "user", content: "pi-subagent:wake pi" }],
    system: [
      { type: "text", text: "You are Claude Code." },
      {
        type: "text",
        text: "Use pi.\npi ~/.pi/",
        cache_control: { type: "ephemeral" },
      },
    ],
  };
  assert.deepEqual(await handler({ payload: triggered }, anthropic), {
    ...triggered,
    system: [
      { type: "text", text: "You are Claude Code." },
      {
        type: "text",
        text: "Use PI.\nPI ~/.pi/",
        cache_control: { type: "ephemeral" },
      },
    ],
  });
  assert.equal(triggered.system[1].text, "Use pi.\npi ~/.pi/");

  assert.equal(
    await handler({ payload: { messages: [] } }, anthropic),
    undefined,
  );
  assert.equal(
    await handler(
      { payload: { system: "pi" } },
      { model: { provider: "google" } },
    ),
    undefined,
  );
}
