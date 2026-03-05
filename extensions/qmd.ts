import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

export default function (pi: ExtensionAPI) {
  async function runQmd(args: string[], signal?: AbortSignal) {
    const res = await pi.exec("qmd", args, { signal, timeout: 120 });
    const output =
      [res.stdout, res.stderr].filter(Boolean).join("\n").trim() ||
      "(no output)";
    const trunc = truncateHead(output, {
      maxBytes: DEFAULT_MAX_BYTES,
      maxLines: DEFAULT_MAX_LINES,
    });

    const suffix = trunc.truncated
      ? `\n\n[truncated: ${trunc.outputLines}/${trunc.totalLines} lines, ${trunc.outputBytes}/${trunc.totalBytes} bytes]`
      : "";

    return {
      content: [{ type: "text" as const, text: `${trunc.content}${suffix}` }],
      details: {
        args,
        code: res.code,
        truncated: trunc.truncated,
      },
      isError: res.code !== 0,
    };
  }

  // --- search & retrieval ---

  pi.registerTool({
    name: "qmd_query",
    label: "qmd query",
    description: "search qmd index with search|vsearch|query and json output",
    parameters: Type.Object({
      query: Type.String(),
      mode: Type.Optional(
        StringEnum(["query", "search", "vsearch"] as const),
      ),
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
      return runQmd(args, signal);
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
      return runQmd(args, signal);
    },
  });

  // --- index management ---

  pi.registerTool({
    name: "qmd_update",
    label: "qmd update",
    description: "run qmd update, optional embed",
    parameters: Type.Object({
      embed: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_toolCallId, params, signal) {
      const update = await runQmd(["update"], signal);
      if (!params.embed) return update;

      const embed = await runQmd(["embed"], signal);
      return {
        content: [
          {
            type: "text" as const,
            text: `${update.content?.[0]?.text ?? ""}\n\n${embed.content?.[0]?.text ?? ""}`.trim(),
          },
        ],
        details: {
          update: update.details,
          embed: embed.details,
        },
        isError: Boolean(update.isError || embed.isError),
      };
    },
  });

  pi.registerTool({
    name: "qmd_collection_add",
    label: "qmd collection add",
    description:
      "add a directory or file to qmd as a named collection. indexes the content for search. use mask to filter file types (e.g. '*.md', '*.nix').",
    parameters: Type.Object({
      path: Type.String({ description: "path to directory or file to index" }),
      name: Type.String({ description: "collection name" }),
      mask: Type.Optional(
        Type.String({
          description: "glob pattern to filter files (e.g. '*.md')",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const args = ["collection", "add", params.path, "--name", params.name];
      if (params.mask) args.push("--mask", params.mask);
      return runQmd(args, signal);
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
      return runQmd(["collection", "remove", params.name], signal);
    },
  });

  pi.registerTool({
    name: "qmd_collection_list",
    label: "qmd collection list",
    description: "list all qmd collections with details",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal) {
      return runQmd(["collection", "list"], signal);
    },
  });

  pi.registerTool({
    name: "qmd_status",
    label: "qmd status",
    description: "show qmd index status and collections overview",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal) {
      return runQmd(["status"], signal);
    },
  });

  pi.registerTool({
    name: "qmd_embed",
    label: "qmd embed",
    description:
      "create vector embeddings for all indexed docs. run after adding collections or updating index. use force to re-embed everything.",
    parameters: Type.Object({
      force: Type.Optional(
        Type.Boolean({
          default: false,
          description: "re-embed all docs, not just new/changed ones",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const args = ["embed"];
      if (params.force) args.push("-f");
      return runQmd(args, signal);
    },
  });
}
