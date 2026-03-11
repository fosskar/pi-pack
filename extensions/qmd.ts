import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

type QmdExecResult = {
  code: number;
  stdout?: string;
  stderr?: string;
};

type MemoryHit = {
  docid?: string;
  score?: number;
  file?: string;
  title?: string;
  snippet?: string;
};

const cwd = process.cwd();
const projectSlug = basename(cwd).toLowerCase().replace(/[^a-z0-9._-]/g, "-") || "project";
const projectHash = createHash("sha1").update(cwd).digest("hex").slice(0, 8);
const memoryCollection = `pi-memory-${projectSlug}-${projectHash}`;
const memoryDir = join(cwd, ".pi", "qmd-memory");
const AUTO_SAVE_MIN_INTERVAL_MS = 5 * 60 * 1000;

export default function (pi: ExtensionAPI) {
  let enabled = true;
  let dirty = false;
  let ensured = false;
  let degradedMode = false;
  let degradedReason = "";
  let lastAutoSaveAt = 0;
  let refreshTimer: NodeJS.Timeout | undefined;

  async function runQmd(args: string[], signal?: AbortSignal, timeout = 120): Promise<QmdExecResult> {
    const res = await pi.exec("qmd", args, { signal, timeout });
    return {
      code: res.code,
      stdout: res.stdout,
      stderr: res.stderr,
    };
  }

  function compactOutput(text: string) {
    const trunc = truncateHead(text, {
      maxBytes: DEFAULT_MAX_BYTES,
      maxLines: DEFAULT_MAX_LINES,
    });
    const suffix = trunc.truncated
      ? `\n\n[truncated: ${trunc.outputLines}/${trunc.totalLines} lines, ${trunc.outputBytes}/${trunc.totalBytes} bytes]`
      : "";
    return `${trunc.content}${suffix}`;
  }

  function parseJsonArray(text: string): MemoryHit[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start < 0 || end < 0 || end < start) return [];
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return Array.isArray(parsed) ? (parsed as MemoryHit[]) : [];
    } catch {
      return [];
    }
  }

  function firstErrorLine(res: QmdExecResult) {
    const raw = [res.stderr, res.stdout].filter(Boolean).join("\n").trim();
    return raw.split("\n").find((line) => line.trim().length > 0)?.trim() || "unknown error";
  }

  function currentModeLabel() {
    return degradedMode ? "lexical-only (degraded)" : "hybrid";
  }

  async function ensureMemoryCollection(signal?: AbortSignal) {
    if (ensured) return;
    await mkdir(memoryDir, { recursive: true });

    const list = await runQmd(["collection", "list"], signal, 20);
    const hasCollection = (list.stdout || "").includes(memoryCollection);
    if (!hasCollection) {
      await runQmd([
        "collection",
        "add",
        memoryDir,
        "--name",
        memoryCollection,
        "--mask",
        "**/*.md",
      ], signal, 60);
      dirty = true;
    }
    ensured = true;
  }

  async function refreshIndex(signal?: AbortSignal, embed = false) {
    if (!dirty && !embed) return;
    const update = await runQmd(["update"], signal, 240);
    if (embed) await runQmd(["embed"], signal, 240);
    dirty = update.code !== 0 ? true : false;
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        await ensureMemoryCollection();
        await refreshIndex(undefined, false);
      } catch {
        // ignore background refresh errors
      }
    }, 3000);
  }

  async function searchMemory(query: string, n = 5, minScore = 0.2, signal?: AbortSignal): Promise<MemoryHit[]> {
    await ensureMemoryCollection(signal);

    const queryRes = await runQmd([
      "query",
      query,
      "--json",
      "-n",
      String(n),
      "--min-score",
      String(minScore),
      "-c",
      memoryCollection,
    ], signal, 120);

    if (queryRes.code === 0) {
      const queryHits = parseJsonArray(queryRes.stdout || "");
      degradedMode = false;
      degradedReason = "";
      if (queryHits.length > 0) return queryHits;
    } else {
      degradedMode = true;
      degradedReason = firstErrorLine(queryRes);
    }

    const searchRes = await runQmd([
      "search",
      query,
      "--json",
      "-n",
      String(n),
      "--min-score",
      String(minScore),
      "-c",
      memoryCollection,
    ], signal, 60);

    if (searchRes.code !== 0 && !degradedReason) {
      degradedReason = firstErrorLine(searchRes);
    }

    return parseJsonArray(searchRes.stdout || "");
  }

  function formatHits(hits: MemoryHit[]) {
    if (!hits.length) return "(no memory hits)";
    return hits
      .map((h, i) => {
        const score = h.score !== undefined ? ` (${Math.round(h.score * 100)}%)` : "";
        return `${i + 1}. ${h.file || h.title || "unknown"}${score}\n${(h.snippet || "").trim()}`;
      })
      .join("\n\n");
  }

  async function saveMemoryNote(title: string, body: string, tags?: string[]) {
    await mkdir(memoryDir, { recursive: true });
    const tagText = tags && tags.length ? tags.map((t) => `#${t}`).join(" ") : "#memory";
    const normalizedBody = body.trim();
    const content = `# ${title}\n\n${normalizedBody}\n\n${tagText}\n`;
    const noteHash = createHash("sha1").update(content).digest("hex").slice(0, 10);

    const existingFiles = await readdir(memoryDir).catch(() => []);
    const deduped = existingFiles.find((file) => file.endsWith(`-${noteHash}.md`));
    if (deduped) {
      return { path: join(memoryDir, deduped), saved: false, deduped: true };
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "memory";
    const filepath = join(memoryDir, `${stamp}-${slug}-${noteHash}.md`);
    await writeFile(filepath, content, "utf8");
    dirty = true;
    scheduleRefresh();
    return { path: filepath, saved: true, deduped: false };
  }

  pi.on("session_start", async (_event, _ctx) => {
    await ensureMemoryCollection();
  });

  pi.on("before_agent_start", async (event) => {
    if (!enabled) return;
    await ensureMemoryCollection();
    if (dirty) await refreshIndex(undefined, false);

    const hits = await searchMemory(event.prompt, 4, 0.28);
    if (!hits.length) return;

    const memoryContext = formatHits(hits);
    return {
      systemPrompt:
        event.systemPrompt +
        "\n\n## persistent project memory (qmd)\n" +
        "use this as supporting memory, not as absolute truth. verify with files when needed.\n\n" +
        memoryContext,
    };
  });

  pi.on("agent_end", async (event) => {
    if (!enabled) return;

    const userText = event.messages
      .filter((m: any) => m.role === "user")
      .flatMap((m: any) => (Array.isArray(m.content) ? m.content : []))
      .filter((c: any) => c?.type === "text" && typeof c.text === "string")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    const assistantText = event.messages
      .filter((m: any) => m.role === "assistant")
      .flatMap((m: any) => (Array.isArray(m.content) ? m.content : []))
      .filter((c: any) => c?.type === "text" && typeof c.text === "string")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    if (!userText || !assistantText) return;
    if (assistantText.length < 120) return;

    const now = Date.now();
    if (now - lastAutoSaveAt < AUTO_SAVE_MIN_INTERVAL_MS) return;

    const title = `turn memory: ${userText.split("\n")[0]?.slice(0, 80) || "summary"}`;
    const body = [
      "## user request",
      userText.slice(0, 1800),
      "",
      "## assistant outcome",
      assistantText.slice(0, 3000),
    ].join("\n");

    const saved = await saveMemoryNote(title, body, ["auto", "turn"]);
    if (saved.saved) lastAutoSaveAt = now;
  });

  pi.registerCommand("memory", {
    description: "memory controls: help|status|on|off|rebuild",
    handler: async (args, ctx) => {
      const sub = (args || "status").trim().toLowerCase();

      if (sub === "help") {
        ctx.ui.notify("/memory help | status | on | off | rebuild", "info");
        return;
      }

      if (sub === "on") {
        enabled = true;
        ctx.ui.notify("memory enabled", "success");
        return;
      }
      if (sub === "off") {
        enabled = false;
        ctx.ui.notify("memory disabled", "warning");
        return;
      }
      if (sub === "rebuild") {
        await ensureMemoryCollection();
        await refreshIndex(undefined, false);
        ctx.ui.notify("memory index refreshed", "success");
        return;
      }
      if (sub !== "status") {
        ctx.ui.notify("unknown /memory subcommand. use: /memory help", "warning");
        return;
      }

      await ensureMemoryCollection();
      const files = await readdir(memoryDir).catch(() => []);
      const waitMs = Math.max(0, AUTO_SAVE_MIN_INTERVAL_MS - (Date.now() - lastAutoSaveAt));
      const waitSec = Math.ceil(waitMs / 1000);
      const degraded = degradedMode
        ? ` | mode=${currentModeLabel()} | reason=${degradedReason}`
        : ` | mode=${currentModeLabel()}`;
      ctx.ui.notify(
        `memory: ${enabled ? "on" : "off"} | collection=${memoryCollection} | files=${files.length} | dirty=${dirty} | autosave-cooldown=${waitSec}s${degraded}`,
        "info",
      );
    },
  });

  // core qmd tools
  pi.registerTool({
    name: "qmd_query",
    label: "qmd query",
    description: "search qmd index with search|vsearch|query and json output",
    parameters: Type.Object({
      query: Type.String(),
      mode: Type.Optional(StringEnum(["query", "search", "vsearch"] as const)),
      collection: Type.Optional(Type.String()),
      n: Type.Optional(Type.Number({ default: 8 })),
      minScore: Type.Optional(Type.Number({ default: 0.25 })),
    }),
    async execute(_toolCallId, params, signal) {
      const mode = params.mode ?? "query";
      const args = [
        mode,
        params.query,
        "--json",
        "-n",
        String(params.n ?? 8),
        "--min-score",
        String(params.minScore ?? 0.25),
      ];
      if (params.collection) args.push("-c", params.collection);
      const res = await runQmd(args, signal);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      return {
        content: [{ type: "text" as const, text: compactOutput(output) }],
        details: { args, code: res.code },
        isError: res.code !== 0,
      };
    },
  });

  pi.registerTool({
    name: "qmd_get",
    label: "qmd get",
    description: "get qmd doc by path or #docid",
    parameters: Type.Object({
      ref: Type.String({ description: "path or #docid" }),
      full: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, signal) {
      const ref = params.ref.startsWith("@") ? params.ref.slice(1) : params.ref;
      const args = ["get", ref];
      if (params.full) args.push("--full");
      const res = await runQmd(args, signal);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      return {
        content: [{ type: "text" as const, text: compactOutput(output) }],
        details: { args, code: res.code },
        isError: res.code !== 0,
      };
    },
  });

  pi.registerTool({
    name: "qmd_update",
    label: "qmd update",
    description: "run qmd update, optional embed",
    parameters: Type.Object({
      embed: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, signal) {
      const update = await runQmd(["update"], signal, 240);
      let text = [update.stdout, update.stderr].filter(Boolean).join("\n").trim();
      let isError = update.code !== 0;
      if (params.embed) {
        const embed = await runQmd(["embed"], signal, 240);
        text = `${text}\n\n${[embed.stdout, embed.stderr].filter(Boolean).join("\n").trim()}`.trim();
        isError = isError || embed.code !== 0;
      }
      dirty = false;
      return {
        content: [{ type: "text" as const, text: compactOutput(text || "(no output)") }],
        details: { updateCode: update.code },
        isError,
      };
    },
  });

  pi.registerTool({
    name: "qmd_collection_add",
    label: "qmd collection add",
    description: "add a directory or file to qmd as a named collection. indexes content for search.",
    parameters: Type.Object({
      path: Type.String({ description: "path to directory or file to index" }),
      name: Type.String({ description: "collection name" }),
      mask: Type.Optional(Type.String({ description: "glob pattern to filter files" })),
    }),
    async execute(_toolCallId, params, signal) {
      const args = ["collection", "add", params.path, "--name", params.name];
      if (params.mask) args.push("--mask", params.mask);
      const res = await runQmd(args, signal, 120);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      return {
        content: [{ type: "text" as const, text: compactOutput(output) }],
        details: { args, code: res.code },
        isError: res.code !== 0,
      };
    },
  });

  pi.registerTool({
    name: "qmd_collection_remove",
    label: "qmd collection remove",
    description: "remove a collection from qmd index by name",
    parameters: Type.Object({
      name: Type.String({ description: "collection name to remove" }),
    }),
    async execute(_toolCallId, params, signal) {
      const res = await runQmd(["collection", "remove", params.name], signal, 120);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      return {
        content: [{ type: "text" as const, text: compactOutput(output) }],
        details: { code: res.code },
        isError: res.code !== 0,
      };
    },
  });

  pi.registerTool({
    name: "qmd_collection_list",
    label: "qmd collection list",
    description: "list all qmd collections with details",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal) {
      const res = await runQmd(["collection", "list"], signal, 20);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      return {
        content: [{ type: "text" as const, text: compactOutput(output) }],
        details: { code: res.code },
        isError: res.code !== 0,
      };
    },
  });

  pi.registerTool({
    name: "qmd_status",
    label: "qmd status",
    description: "show qmd index status and collections overview",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal) {
      const res = await runQmd(["status"], signal, 40);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      return {
        content: [{ type: "text" as const, text: compactOutput(output) }],
        details: { code: res.code },
        isError: res.code !== 0,
      };
    },
  });

  pi.registerTool({
    name: "qmd_embed",
    label: "qmd embed",
    description: "create vector embeddings for all indexed docs",
    parameters: Type.Object({
      force: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, signal) {
      const args = ["embed"];
      if (params.force) args.push("-f");
      const res = await runQmd(args, signal, 240);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim() || "(no output)";
      return {
        content: [{ type: "text" as const, text: compactOutput(output) }],
        details: { args, code: res.code },
        isError: res.code !== 0,
      };
    },
  });

  // memory tools
  pi.registerTool({
    name: "memory_search",
    label: "memory search",
    description: "search persistent project memory stored in qmd",
    parameters: Type.Object({
      query: Type.String(),
      n: Type.Optional(Type.Number({ default: 5 })),
      minScore: Type.Optional(Type.Number({ default: 0.25 })),
    }),
    async execute(_toolCallId, params, signal) {
      const hits = await searchMemory(params.query, params.n ?? 5, params.minScore ?? 0.25, signal);
      return {
        content: [{ type: "text" as const, text: formatHits(hits) }],
        details: { hits, collection: memoryCollection },
      };
    },
  });

  pi.registerTool({
    name: "memory_save",
    label: "memory save",
    description: "save a durable memory note into qmd memory collection",
    parameters: Type.Object({
      title: Type.String(),
      content: Type.String(),
      tags: Type.Optional(Type.Array(Type.String())),
      updateNow: Type.Optional(Type.Boolean({ default: true })),
    }),
    async execute(_toolCallId, params, signal) {
      const result = await saveMemoryNote(params.title, params.content, params.tags);
      if ((params.updateNow ?? true) && result.saved) {
        await refreshIndex(signal, false);
      }
      return {
        content: [{ type: "text" as const, text: result.saved ? `saved memory note: ${result.path}` : `deduped memory note: ${result.path}` }],
        details: { ...result, collection: memoryCollection },
      };
    },
  });

  pi.registerTool({
    name: "memory_status",
    label: "memory status",
    description: "show memory integration status",
    parameters: Type.Object({}),
    async execute() {
      await ensureMemoryCollection();
      const files = await readdir(memoryDir).catch(() => []);
      const waitMs = Math.max(0, AUTO_SAVE_MIN_INTERVAL_MS - (Date.now() - lastAutoSaveAt));
      const text = [
        `enabled: ${enabled}`,
        `mode: ${currentModeLabel()}`,
        ...(degradedMode ? [`degraded_reason: ${degradedReason}`] : []),
        `collection: ${memoryCollection}`,
        `dir: ${memoryDir}`,
        `files: ${files.length}`,
        `dirty: ${dirty}`,
        `autosave_cooldown_seconds: ${Math.ceil(waitMs / 1000)}`,
      ].join("\n");
      return {
        content: [{ type: "text" as const, text }],
        details: {
          enabled,
          mode: currentModeLabel(),
          degradedMode,
          degradedReason,
          collection: memoryCollection,
          files: files.length,
          dirty,
          autosaveCooldownMs: waitMs,
        },
      };
    },
  });

  pi.registerTool({
    name: "memory_forget",
    label: "memory forget",
    description: "delete memory notes whose filename/content matches a substring",
    parameters: Type.Object({
      contains: Type.String({ description: "substring to match" }),
    }),
    async execute(_toolCallId, params) {
      await ensureMemoryCollection();
      const files = await readdir(memoryDir).catch(() => []);
      const needle = params.contains.toLowerCase();
      const deleted: string[] = [];

      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const fp = join(memoryDir, file);
        const content = await readFile(fp, "utf8").catch(() => "");
        if (file.toLowerCase().includes(needle) || content.toLowerCase().includes(needle)) {
          await rm(fp, { force: true });
          deleted.push(file);
        }
      }

      if (deleted.length > 0) {
        dirty = true;
        scheduleRefresh();
      }

      return {
        content: [{
          type: "text" as const,
          text: deleted.length ? `deleted ${deleted.length} notes:\n${deleted.join("\n")}` : "no matching notes",
        }],
        details: { deleted },
      };
    },
  });
}
