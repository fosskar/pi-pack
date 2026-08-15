import { mock } from "bun:test";

const schema = new Proxy(() => ({}), {
  apply: () => ({}),
  get: () => schema,
});

class Component {
  constructor(..._args: unknown[]) {}
  addChild(_child: unknown): void {}
  setText(_text: string): void {}
}

mock.module("typebox", () => ({ Type: schema }));
mock.module("@earendil-works/pi-ai", () => ({
  complete: async () => ({ content: [], stopReason: "stop" }),
  StringEnum: () => ({}),
}));
mock.module("@earendil-works/pi-coding-agent", () => ({
  BorderedLoader: Component,
  DefaultResourceLoader: Component,
  SessionManager: Component,
  buildSessionContext: () => ({}),
  convertToLlm: (messages: unknown) => messages,
  createAgentSession: async () => ({}),
  getAgentDir: () => "/tmp/pi-pack-tests",
}));
mock.module("@earendil-works/pi-tui", () => ({
  Box: Component,
  Container: Component,
  Input: Component,
  Text: Component,
  Key: {
    alt: (key: string) => `alt+${key}`,
    ctrlAlt: (key: string) => `ctrl+alt+${key}`,
  },
  matchesKey: () => false,
  truncateToWidth: (text: string) => text,
  visibleWidth: (text: string) => text.length,
  wrapTextWithAnsi: (text: string) => [text],
}));
