import { mock } from "bun:test";

const schema = new Proxy(() => ({}), {
  apply: () => ({}),
  get: () => schema,
});

class Component {
  constructor(..._args: unknown[]) {}
}

mock.module("typebox", () => ({ Type: schema }));
mock.module("@earendil-works/pi-ai", () => ({
  StringEnum: () => ({}),
}));
mock.module("@earendil-works/pi-coding-agent", () => ({
  BorderedLoader: Component,
  convertToLlm: (messages: unknown) => messages,
}));
mock.module("@earendil-works/pi-tui", () => ({
  Text: Component,
  matchesKey: () => false,
  visibleWidth: (text: string) => text.length,
}));
