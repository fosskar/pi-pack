import assert from "node:assert/strict";
import extension from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

export default async function (): Promise<void> {
  const mock = createMockPi();
  extension(mock.pi as never);
  const tool = mock.tools.get("second_opinion");
  assert.ok(tool);

  const result = await tool.execute(
    "call-1",
    { prompt: "Review this" },
    undefined,
    undefined,
    {
      model: { id: "current" },
      modelRegistry: { getAvailable: () => [] },
    },
  );
  assert.match(result.content[0].text, /no alternative models available/);
}
