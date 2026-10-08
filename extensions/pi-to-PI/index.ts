import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Replaces standalone lowercase "pi" with "PI" in the system prompt.
// Uses lookbehind/lookahead so paths like ~/.pi/ and pi-coding-agent are untouched.
// Runs on before_provider_request because before_agent_start skips turns
// triggered by sendCustomMessage.

const rewrite = (text: string) =>
  text.replace(/(?<=^|\s)pi(?=\s|[,.]|$)/gm, "PI");

export default function (pi: ExtensionAPI) {
  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== "anthropic") return;
    const payload = event.payload as { system?: unknown };
    const { system } = payload;
    if (typeof system === "string") {
      return { ...payload, system: rewrite(system) };
    }
    if (!Array.isArray(system)) return;
    return {
      ...payload,
      system: system.map((block) =>
        block?.type === "text" && typeof block.text === "string"
          ? { ...block, text: rewrite(block.text) }
          : block,
      ),
    };
  });
}
