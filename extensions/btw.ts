/**
 * /btw - ask a quick side question without interrupting the agent's current work
 *
 * replicates claude code's /btw feature. when the agent is busy, type:
 *   /btw what's the difference between map and flatMap?
 *   btw how do i format a date in typescript?
 *
 * makes a separate api call and shows the answer in a notification,
 * without affecting the main conversation context.
 */

import { complete, type Message } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

const SYSTEM_PROMPT = `you are a quick-answer assistant. answer the user's side question concisely and directly. keep responses short (1-5 sentences). no preamble, no filler. if code is needed, keep it minimal.`;

export default function (pi: ExtensionAPI) {
	async function handleBtw(question: string, ctx: any) {
		if (!question.trim()) {
			ctx.ui.notify("usage: /btw <question>", "warning");
			return;
		}

		if (!ctx.model) {
			ctx.ui.notify("no model selected", "error");
			return;
		}

		if (!ctx.hasUI) {
			ctx.ui.notify("btw requires interactive mode", "error");
			return;
		}

		const result = await ctx.ui.custom<string | null>((tui: any, theme: any, _kb: any, done: (v: string | null) => void) => {
			const loader = new BorderedLoader(tui, theme, `btw: thinking...`);
			loader.onAbort = () => done(null);

			const doAnswer = async () => {
				const apiKey = await ctx.modelRegistry.getApiKey(ctx.model!);

				const userMessage: Message = {
					role: "user",
					content: [{ type: "text", text: question }],
					timestamp: Date.now(),
				};

				const response = await complete(
					ctx.model!,
					{ systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
					{ apiKey, signal: loader.signal },
				);

				if (response.stopReason === "aborted") {
					return null;
				}

				return response.content
					.filter((c): c is { type: "text"; text: string } => c.type === "text")
					.map((c) => c.text)
					.join("\n");
			};

			doAnswer()
				.then(done)
				.catch((err) => {
					console.error("btw failed:", err);
					done(null);
				});

			return loader;
		});

		if (result === null) {
			ctx.ui.notify("btw: cancelled", "info");
			return;
		}

		// show answer as a custom message (not part of main conversation context)
		pi.sendMessage({
			customType: "btw-answer",
			content: result,
			display: true,
			details: { question },
		});
	}

	// /btw command
	pi.registerCommand("btw", {
		description: "ask a quick side question without interrupting current work",
		handler: async (args, ctx) => {
			await handleBtw(args, ctx);
		},
	});

	// intercept messages starting with "btw " (without slash)
	pi.on("input", async (event, ctx) => {
		const text = event.text.trim();
		if (/^btw\b\s+/i.test(text)) {
			const question = text.replace(/^btw\s+/i, "");
			await handleBtw(question, ctx);
			return { action: "handled" as const };
		}
	});

	// custom renderer for btw answers
	pi.registerMessageRenderer("btw-answer", (message, _options, theme) => {
		const q = message.details?.question ?? "";
		let text = theme.fg("accent", theme.bold("btw")) + theme.fg("dim", ` ${q}\n`);
		text += message.content;
		return new Text(text, 0, 0);
	});
}
