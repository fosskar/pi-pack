import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createMockPi } from "./helpers.ts";

const extensionsDir = join(import.meta.dir, "..", "extensions");

async function extensionPaths(): Promise<string[]> {
  const entries = await readdir(extensionsDir, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      paths.push(join(extensionsDir, entry.name));
    } else if (entry.isDirectory()) {
      paths.push(join(extensionsDir, entry.name, "index.ts"));
    }
  }

  return paths.sort();
}

async function testExtensionFactoriesLoad(): Promise<void> {
  const paths = await extensionPaths();
  assert.ok(paths.length > 0);

  for (const path of paths) {
    const extension = await import(pathToFileURL(path).href);
    assert.equal(typeof extension.default, "function", path);

    const mock = createMockPi();
    await extension.default(mock.pi);
    assert.ok(
      mock.events.size + mock.commands.size + mock.tools.size > 0,
      `${path} did not register an extension interface`,
    );
  }
}

async function testClipboardTool(): Promise<void> {
  const extension = await import("../extensions/clipboard.ts");
  const mock = createMockPi();
  extension.default(mock.pi as never);
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

async function testPiToPiEvent(): Promise<void> {
  const extension = await import("../extensions/pi-to-PI.ts");
  const mock = createMockPi();
  extension.default(mock.pi as never);
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

async function testOracleWithoutAlternativeModel(): Promise<void> {
  const extension = await import("../extensions/oracle.ts");
  const mock = createMockPi();
  extension.default(mock.pi as never);
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

async function testSketchRequiresInteractiveMode(): Promise<void> {
  const extension = await import("../extensions/sketch/index.ts");
  const mock = createMockPi();
  extension.default(mock.pi as never);
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

async function testBtwMessagesStayOutOfModelContext(): Promise<void> {
  const extension = await import("../extensions/btw.ts");
  const mock = createMockPi();
  extension.default(mock.pi as never);
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

export default async function (): Promise<void> {
  await testExtensionFactoriesLoad();
  await testClipboardTool();
  await testPiToPiEvent();
  await testOracleWithoutAlternativeModel();
  await testSketchRequiresInteractiveMode();
  await testBtwMessagesStayOutOfModelContext();
}
