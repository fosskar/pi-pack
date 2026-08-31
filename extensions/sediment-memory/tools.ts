import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { rm, writeFile } from "node:fs/promises";

import {
  KINDS,
  SCOPES,
  type Fact,
  type Kind,
  type MemoryScope,
} from "./evidence.ts";
import { renderMemorySearchResults, sedimentStore } from "./sediment.ts";

const SEARCH_LIMIT_MAX = 50;
const MEMORY_SUBJECT_MAX_CHARS = 128;
const MEMORY_BODY_MAX_CHARS = 2_000;

interface MemoryInterfaceOptions {
  isDisabled(ctx: ExtensionContext): boolean;
  markerPath(ctx: ExtensionContext): string | undefined;
}

function disabledResult() {
  return {
    content: [
      {
        type: "text" as const,
        text: "Memory is disabled for this session. Use /memory on to re-enable.",
      },
    ],
    details: { disabled: true },
  };
}

export function registerMemoryInterface(
  pi: ExtensionAPI,
  options: MemoryInterfaceOptions,
): void {
  pi.registerCommand("memory", {
    description:
      "Toggle long-term memory capture/recall for this session (on|off|status).",
    handler: async (args, ctx) => {
      const marker = options.markerPath(ctx);
      if (!marker) return;
      const arg = (args ?? "").trim().toLowerCase();
      const disabled = options.isDisabled(ctx);
      if (arg === "status") {
        if (ctx.hasUI)
          ctx.ui.notify(`memory: ${disabled ? "off" : "on"}`, "info");
        return;
      }
      const turnOff = arg === "off" || (!arg && !disabled);
      if (turnOff) {
        await writeFile(marker, "");
      } else {
        await rm(marker, { force: true });
      }
      if (ctx.hasUI) {
        ctx.ui.notify(
          `memory ${turnOff ? "disabled" : "enabled"} for this session`,
          "info",
        );
      }
    },
  });

  pi.registerTool({
    name: "memory_search",
    label: "Memory Search",
    description:
      "Semantic search across long-term memory (facts, preferences, IDs, how-tos from past conversations).",
    promptGuidelines: [
      "Search memory when asked about past conversations, user preferences, or previously used IDs/commands.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query", maxLength: 4_000 }),
      limit: Type.Optional(
        Type.Integer({
          description: "Max results (default 5)",
          default: 5,
          minimum: 1,
          maximum: SEARCH_LIMIT_MAX,
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { query: string; limit?: number },
      signal,
      _onUpdate,
      ctx,
    ) {
      if (options.isDisabled(ctx)) return disabledResult();
      try {
        const limit = Math.max(
          1,
          Math.min(SEARCH_LIMIT_MAX, Math.trunc(params.limit ?? 5)),
        );
        const results = await sedimentStore.search(
          params.query,
          limit,
          signal,
          ctx.sessionManager.getCwd(),
        );
        if (results.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No memories found." }],
            details: { results: [] },
          };
        }
        return {
          content: [
            { type: "text" as const, text: renderMemorySearchResults(results) },
          ],
          details: { results },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory search failed: ${message}`,
            },
          ],
          details: { error: message },
        };
      }
    },
  });

  pi.registerTool({
    name: "memory_store",
    label: "Memory Store",
    description:
      "Store one durable item in long-term memory immediately. Use for " +
      "information the user explicitly asks to remember.",
    promptGuidelines: [
      "Store a memory when the user asks to remember, note, or not " +
        "forget something (\u201cremember that\u2026\u201d, \u201cdon't forget\u2026\u201d), and when a " +
        "stated fact corrects an existing memory. Use project scope for " +
        "repository-specific information and global only for information " +
        "clearly useful across projects. Do not store transient task state " +
        "or secrets.",
    ],
    parameters: Type.Object({
      kind: Type.String({
        description:
          "One of: fact (stable fact about the user or environment), " +
          "pref (preference or convention), id (exact identifier, URL, or " +
          "handle), howto (working one-line command), todo (open task)",
      }),
      scope: Type.Optional(
        Type.String({
          description:
            "project for repository-specific information (default); global " +
            "only for information clearly useful across projects",
          default: "project",
        }),
      ),
      subject: Type.String({
        description:
          "Stable lowercase key of 2-6 words; a later store with the same " +
          "subject supersedes this one",
        maxLength: MEMORY_SUBJECT_MAX_CHARS,
      }),
      body: Type.String({
        description: "One concise sentence, exact identifier, or command",
        maxLength: MEMORY_BODY_MAX_CHARS,
      }),
    }),
    async execute(
      _toolCallId,
      params: {
        kind: string;
        scope?: string;
        subject: string;
        body: string;
      },
      _signal,
      _onUpdate,
      ctx,
    ) {
      if (options.isDisabled(ctx)) return disabledResult();
      const kind = params.kind.trim().toLowerCase() as Kind;
      if (!(KINDS as readonly string[]).includes(kind)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid kind "${params.kind}". Use one of: ${KINDS.join(", ")}.`,
            },
          ],
          details: { error: "invalid kind" },
        };
      }
      const scope = (params.scope ?? "project")
        .trim()
        .toLowerCase() as MemoryScope;
      if (!(SCOPES as readonly string[]).includes(scope)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid scope "${params.scope}". Use one of: ${SCOPES.join(", ")}.`,
            },
          ],
          details: { error: "invalid scope" },
        };
      }
      const fact: Fact = {
        kind,
        scope,
        subject: params.subject.trim().toLowerCase(),
        body: params.body.trim(),
      };
      if (!fact.subject || !fact.body) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Subject and body must be non-empty.",
            },
          ],
          details: { error: "empty field" },
        };
      }
      if (
        fact.subject.length > MEMORY_SUBJECT_MAX_CHARS ||
        fact.body.length > MEMORY_BODY_MAX_CHARS
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Memory is too large (subject max ${MEMORY_SUBJECT_MAX_CHARS}, ` +
                `body max ${MEMORY_BODY_MAX_CHARS} characters).`,
            },
          ],
          details: { error: "memory too large" },
        };
      }
      try {
        await sedimentStore.storeFacts([fact], ctx.sessionManager.getCwd());
        return {
          content: [
            {
              type: "text" as const,
              text: `Stored: [${fact.kind}] ${fact.subject}: ${fact.body}`,
            },
          ],
          details: { fact },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory store failed: ${message}`,
            },
          ],
          details: { error: message },
        };
      }
    },
  });

  pi.registerTool({
    name: "memory_forget",
    label: "Memory Forget",
    description: "Delete one item from long-term memory by its id.",
    promptGuidelines: [
      "Curate memory actively: when a recalled or searched item is " +
        "contradicted by newer information, duplicated, or clearly " +
        "outdated, delete it with the id from memory_search results " +
        "\u2014 no need to ask. Cross-project items are read-only from the " +
        "current project. When a correction replaces an editable item, " +
        "store the corrected item too.",
    ],
    parameters: Type.Object({
      id: Type.String({ description: "Item id from memory_search results" }),
    }),
    async execute(
      _toolCallId,
      params: { id: string },
      _signal,
      _onUpdate,
      ctx,
    ) {
      if (options.isDisabled(ctx)) return disabledResult();
      const id = params.id.trim();
      if (!id) {
        return {
          content: [{ type: "text" as const, text: "Id must be non-empty." }],
          details: { error: "empty id" },
        };
      }
      try {
        await sedimentStore.forget(id, ctx.sessionManager.getCwd());
        return {
          content: [{ type: "text" as const, text: `Forgot memory ${id}.` }],
          details: { id },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory forget failed: ${message}`,
            },
          ],
          details: { error: message },
        };
      }
    },
  });
}
