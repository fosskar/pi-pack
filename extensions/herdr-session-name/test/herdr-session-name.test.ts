import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import extension from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

type Request = { method: string; params: Record<string, unknown> };

export default async function (): Promise<void> {
  const env = { ...process.env };
  const dir = mkdtempSync(path.join(tmpdir(), "herdr-session-name-"));
  const socketPath = path.join(dir, "herdr.sock");
  const requests: Request[] = [];
  let failWith: string | undefined;

  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    socket.on("data", (line: string) => {
      const request = JSON.parse(line);
      requests.push({ method: request.method, params: request.params });
      const response = failWith
        ? { id: request.id, error: { code: "x", message: failWith } }
        : { id: request.id, result: {} };
      socket.write(`${JSON.stringify(response)}\n`);
    });
  });
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));

  try {
    delete process.env.HERDR_ENV;
    const outside = createMockPi();
    extension(outside.pi as never);
    assert.equal(outside.events.size, 0);

    process.env.HERDR_ENV = "1";
    process.env.HERDR_SOCKET_PATH = socketPath;
    process.env.HERDR_PANE_ID = "w1:p1";

    let sessionName: string | undefined;
    const mock = createMockPi();
    Object.assign(mock.pi, { getSessionName: () => sessionName });
    extension(mock.pi as never);
    const start = mock.events.get("session_start")?.[0];
    const changed = mock.events.get("session_info_changed")?.[0];
    assert.ok(start && changed);

    await start({}, { mode: "rpc", cwd: "/src/nixfiles" });
    await changed({ name: "ignored" }, { mode: "rpc", cwd: "/src/nixfiles" });
    assert.equal(requests.length, 0);

    const ctx = { mode: "tui", cwd: "/src/nixfiles" };
    await start({}, ctx);
    sessionName = "fix herdr labels";
    await changed({ name: sessionName }, ctx);
    await changed({}, ctx);

    assert.deepEqual(
      requests.map((request) => request.method),
      Array(3).fill("pane.report_metadata"),
    );
    assert.deepEqual(
      requests.map((request) => request.params.display_agent),
      ["𜵨▚ nixfiles", "𜵨▚ fix herdr labels", "𜵨▚ nixfiles"],
    );
    const [first, second] = requests.map((request) => request.params);
    assert.equal(first.pane_id, "w1:p1");
    assert.equal(first.agent, "pi");
    assert.equal(first.source, "pi-pack:herdr-session-name");
    assert.ok((second.seq as number) > (first.seq as number));

    failWith = "pane w1:p1 not found";
    await assert.rejects(
      changed({ name: "x" }, ctx),
      /herdr pane.report_metadata: pane w1:p1 not found/,
    );
  } finally {
    process.env = env;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}
