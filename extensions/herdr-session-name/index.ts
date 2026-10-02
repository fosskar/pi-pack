import net from "node:net";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SOURCE = "pi-pack:herdr-session-name";
const TIMEOUT_MS = 2000;

function herdrRequest(
  socketPath: string,
  method: string,
  params: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = "";
    socket.setEncoding("utf8");
    socket.setTimeout(TIMEOUT_MS);
    socket.on("connect", () => {
      socket.write(`${JSON.stringify({ id: SOURCE, method, params })}\n`);
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      socket.destroy();
      const response = JSON.parse(buffer.slice(0, newline));
      if (response.error) {
        reject(new Error(`herdr ${method}: ${response.error.message}`));
      } else {
        resolve();
      }
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`herdr ${method}: no response in ${TIMEOUT_MS} ms`));
    });
    socket.on("end", () => {
      reject(new Error(`herdr ${method}: socket closed without a response`));
    });
    socket.on("error", reject);
  });
}

export default function (pi: ExtensionAPI) {
  const socketPath = process.env.HERDR_SOCKET_PATH;
  const paneId = process.env.HERDR_PANE_ID;
  if (process.env.HERDR_ENV !== "1" || !socketPath || !paneId) return;

  let active = false;
  let seq = Date.now() * 1000;

  const report = (sessionName: string | undefined, cwd: string) =>
    herdrRequest(socketPath, "pane.report_metadata", {
      pane_id: paneId,
      source: SOURCE,
      agent: "pi",
      display_agent: `π ${sessionName || path.basename(cwd)}`,
      seq: ++seq,
    });

  pi.on("session_start", async (_event, ctx) => {
    // rpc, json, and print runs share the pane env but are not what herdr shows
    active = ctx.mode === "tui";
    if (!active) return;
    await report(pi.getSessionName(), ctx.cwd);
  });

  pi.on("session_info_changed", async (event, ctx) => {
    if (!active) return;
    await report(event.name, ctx.cwd);
  });
}
