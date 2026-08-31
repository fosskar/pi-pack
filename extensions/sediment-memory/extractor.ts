import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { complete } from "@earendil-works/pi-ai";

import type { ExtractionRequest, Fact } from "./evidence.ts";

const EXTRACT_TIMEOUT = 30_000;

/** Ask the active model to extract evidence-backed facts from a batch. */
export async function extractFacts(
  ctx: ExtensionContext,
  request: ExtractionRequest,
  signal?: AbortSignal,
): Promise<Fact[]> {
  const model = ctx.model;
  if (!model) throw new Error("no active model");

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) {
    throw new Error("model authentication unavailable");
  }

  const deadline = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(EXTRACT_TIMEOUT)])
    : AbortSignal.timeout(EXTRACT_TIMEOUT);

  try {
    const response = await complete(
      model,
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${request.prompt}\n\n<source_records>\n${request.input}\n</source_records>`,
              },
            ],
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        maxTokens: 512,
        signal: deadline,
      },
    );
    const text = response.content
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text",
      )
      .map((part) => part.text)
      .join("\n");
    return request.parse(text);
  } catch (error) {
    console.error("memory: extract call failed", error);
    throw error;
  }
}
