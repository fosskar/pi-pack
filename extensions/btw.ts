/**
 * btw — side-channel questions that don't pollute the main conversation.
 *
 * /btw <question>       ask fresh (default, no session context)
 * /btw ctx <question>   ask with session context
 * /btw fresh <question> explicit fresh mode
 * /btw log              scroll past answers
 * /btw clear            clear btw history
 * ctrl+shift+b          shortcut to prefill /btw in editor
 *
 * answer shows in a bordered overlay, dismiss with enter/esc.
 */

import {
  buildSessionContext,
  type ExtensionAPI,
  type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  streamSimple,
  type AssistantMessage,
  type ThinkingLevel as AiThinkingLevel,
} from "@mariozechner/pi-ai";
import { Key, matchesKey, visibleWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

interface Answer {
  q: string;
  a: string;
  model: string;
  fresh: boolean;
  ts: number;
  tokens?: { in: number; out: number };
}

const log: Answer[] = [];

// ── helpers ─────────────────────────────────────────────────

function makeContext(ctx: ExtensionContext, question: string, fresh: boolean) {
  if (fresh) {
    return {
      systemPrompt: "answer concisely. no filler. 1-5 sentences unless code is needed.",
      messages: [{ role: "user" as const, content: [{ type: "text" as const, text: question }], timestamp: Date.now() }],
    };
  }
  const sc = buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId());
  return {
    systemPrompt: ctx.getSystemPrompt(),
    messages: [
      ...sc.messages,
      { role: "user" as const, content: [{ type: "text" as const, text: question }], timestamp: Date.now() },
    ],
  };
}

async function doAsk(
  ctx: ExtensionContext,
  question: string,
  fresh: boolean,
  signal?: AbortSignal,
): Promise<AssistantMessage | null> {
  const model = ctx.model!;
  const apiKey = await ctx.modelRegistry.getApiKey(model);
  if (!apiKey) throw new Error(`no key for ${model.provider}/${model.id}`);
  const thinking = (ctx as any).getThinkingLevel?.() as "off" | AiThinkingLevel | undefined;
  const reasoning = thinking && thinking !== "off" ? thinking : undefined;
  const res = await streamSimple(model, makeContext(ctx, question, fresh), { apiKey, reasoning, signal }).result();
  if (res.stopReason === "aborted") return null;
  if (res.stopReason === "error") throw new Error(res.errorMessage || "btw failed");
  return res;
}

function extractText(msg: AssistantMessage): string {
  return msg.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim() || "(empty)";
}

function wrapText(text: string, width: number): string[] {
  const out: string[] = [];
  const w = Math.max(8, width);
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.length <= w) {
      out.push(line);
      continue;
    }
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let cur = "";
    for (const word of words) {
      // hard-break super long single words
      if (word.length > w) {
        if (cur) {
          out.push(cur);
          cur = "";
        }
        for (let i = 0; i < word.length; i += w) out.push(word.slice(i, i + w));
        continue;
      }
      const next = cur ? `${cur} ${word}` : word;
      if (next.length <= w) cur = next;
      else {
        out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function panel(theme: Theme, width: number, body: string[], footer: string): string[] {
  const inner = Math.max(20, width - 2);
  const pad = (s: string) => s + " ".repeat(Math.max(0, inner - visibleWidth(s)));
  const row = (s: string) => `${theme.fg("border", "│")}${pad(s)}${theme.fg("border", "│")}`;
  return [
    theme.fg("border", `╭${"─".repeat(inner)}╮`),
    ...body.map(row),
    theme.fg("border", `├${"─".repeat(inner)}┤`),
    row(theme.fg("dim", footer)),
    theme.fg("border", `╰${"─".repeat(inner)}╯`),
  ];
}

// ── core ask flow ───────────────────────────────────────────

async function handleBtw(q: string, fresh: boolean, ctx: ExtensionContext) {
  if (!q.trim()) { ctx.hasUI && ctx.ui.notify("/btw <question> | /btw ctx <question> | /btw log", "warning"); return; }
  if (!ctx.model) { ctx.hasUI && ctx.ui.notify("no model", "error"); return; }

  const modelShort = ctx.model.id.replace(/^claude-/, "").replace(/-\d{8}$/, "");
  const mode = fresh ? "fresh" : "ctx";

  let entry: Answer | null = null;
  if (ctx.hasUI) {
    const abortCtrl = new AbortController();
    entry = await ctx.ui.custom<Answer | null>(
      (_tui, theme, _kb, done) => {
        let phase: "loading" | "done" = "loading";
        let answer = "";
        let tokens: { in: number; out: number } | undefined;

        doAsk(ctx, q, fresh, abortCtrl.signal).then((res) => {
          if (!res) { done(null); return; }
          answer = extractText(res);
          tokens = res.usage ? { in: res.usage.input, out: res.usage.output } : undefined;
          phase = "done";
        }).catch((e) => {
          ctx.ui.notify(e instanceof Error ? e.message : String(e), "error");
          done(null);
        });

        return {
          handleInput(data: string) {
            if (matchesKey(data, Key.escape)) {
              if (phase === "loading") abortCtrl.abort();
              done(phase === "done" ? { q, a: answer, model: modelShort, fresh, ts: Date.now(), tokens } : null);
              return;
            }
            if (phase === "done" && matchesKey(data, Key.enter)) {
              done({ q, a: answer, model: modelShort, fresh, ts: Date.now(), tokens });
            }
          },
          render(width: number): string[] {
            const w = Math.max(24, width - 2);
            if (phase === "loading") {
              return panel(theme, w, [
                ` ${theme.fg("accent", theme.bold("btw"))} ${theme.fg("dim", `${modelShort} · ${mode}`)}`,
                "",
                ` ${theme.fg("dim", "q:")} ${q}`,
                "",
                ` ${theme.fg("dim", "thinking...")}`,
              ], "esc cancel");
            }
            const tok = tokens ? theme.fg("dim", ` · ${tokens.in}→${tokens.out}`) : "";
            return panel(theme, w, [
              ` ${theme.fg("accent", theme.bold("btw"))} ${theme.fg("dim", modelShort)}${tok}`,
              "",
              ` ${theme.fg("dim", "q:")} ${q}`,
              "",
              ...wrapText(answer, w - 2).map((l) => ` ${l}`),
            ], "enter/esc dismiss");
          },
          invalidate() {},
          dispose() {},
        };
      },
      { overlay: true, overlayOptions: { width: "72%", maxHeight: "65%", minWidth: 60, anchor: "top-center", margin: 1 } },
    );
  } else {
    const res = await doAsk(ctx, q, fresh);
    if (!res) return;
    const answer = extractText(res);
    entry = { q, a: answer, model: modelShort, fresh, ts: Date.now(), tokens: res.usage ? { in: res.usage.input, out: res.usage.output } : undefined };
  }

  if (!entry) return;
  log.push(entry);
}

// ── extension ───────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  async function showLog(ctx: ExtensionContext) {
    if (!ctx.hasUI || log.length === 0) {
      ctx.hasUI && ctx.ui.notify("no btw history", "info");
      return;
    }
    let idx = log.length - 1;
    await ctx.ui.custom<void>(
      (_tui, theme, _kb, done) => ({
        handleInput(data: string) {
          if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter)) done(undefined);
          if ((matchesKey(data, Key.left) || data === "k") && idx > 0) idx--;
          if ((matchesKey(data, Key.right) || data === "j") && idx < log.length - 1) idx++;
        },
        render(width: number): string[] {
          const e = log[idx]!;
          const w = Math.max(24, width - 2);
          const nav = theme.fg("dim", `${idx + 1}/${log.length}`);
          const tok = e.tokens ? theme.fg("dim", ` · ${e.tokens.in}→${e.tokens.out}`) : "";
          const time = new Date(e.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          return panel(theme, w, [
            ` ${theme.fg("accent", theme.bold("btw"))} ${nav} ${theme.fg("dim", e.model + " " + time)}${tok}`,
            "",
            ` ${theme.fg("dim", "q:")} ${e.q}`,
            "",
            ...wrapText(e.a, w - 2).map((l) => ` ${l}`),
          ], "←/→ or j/k navigate · enter/esc close");
        },
        invalidate() {},
        dispose() {},
      }),
      { overlay: true, overlayOptions: { width: "72%", maxHeight: "65%", minWidth: 60, anchor: "top-center", margin: 1 } },
    );
  }

  async function runBtwInput(inputRaw: string, ctx: ExtensionContext) {
    const input = inputRaw.trim();
    if (!input) {
      ctx.hasUI && ctx.ui.notify("/btw <question> | /btw ctx <question> | /btw log | /btw clear", "info");
      return;
    }
    if (input === "log") return await showLog(ctx);
    if (input === "clear") {
      log.length = 0;
      ctx.hasUI && ctx.ui.notify("btw history cleared", "info");
      return;
    }
    if (input.startsWith("ctx ")) return await handleBtw(input.slice(4).trim(), false, ctx);
    if (input.startsWith("fresh ")) return await handleBtw(input.slice(6).trim(), true, ctx);
    return await handleBtw(input, true, ctx);
  }

  // /btw <question> | /btw ctx <question> | /btw log | /btw clear
  pi.registerCommand("btw", {
    description: "side question + history",
    handler: async (args, ctx) => runBtwInput(args, ctx),
  });

  // ctrl+shift+b shortcut — prefill /btw in editor
  pi.registerShortcut("ctrl+shift+b", {
    description: "start a btw side question",
    handler: async (ctx) => {
      if (ctx.hasUI) ctx.ui.setEditorText("/btw ");
    },
  });


}
