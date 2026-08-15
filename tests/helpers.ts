type Handler = (...args: any[]) => any;

type RegisteredCommand = {
  description?: string;
  handler: Handler;
};

type RegisteredTool = {
  name: string;
  execute: Handler;
};

export function createMockPi() {
  const events = new Map<string, Handler[]>();
  const commands = new Map<string, RegisteredCommand>();
  const tools = new Map<string, RegisteredTool>();
  const shortcuts = new Map<string, { handler: Handler }>();
  const messageRenderers = new Map<string, Handler>();
  const sentMessages: unknown[] = [];
  const sentUserMessages: unknown[] = [];
  const entries: unknown[] = [];

  const pi = {
    on(name: string, handler: Handler) {
      const handlers = events.get(name) ?? [];
      handlers.push(handler);
      events.set(name, handlers);
    },
    registerCommand(name: string, command: RegisteredCommand) {
      commands.set(name, command);
    },
    registerTool(tool: RegisteredTool) {
      tools.set(tool.name, tool);
    },
    registerShortcut(shortcut: string, definition: { handler: Handler }) {
      shortcuts.set(shortcut, definition);
    },
    registerMessageRenderer(type: string, renderer: Handler) {
      messageRenderers.set(type, renderer);
    },
    appendEntry(type: string, data: unknown) {
      entries.push({ type, data });
    },
    sendMessage(message: unknown) {
      sentMessages.push(message);
    },
    sendUserMessage(message: unknown) {
      sentUserMessages.push(message);
    },
    getThinkingLevel() {
      return "off";
    },
  };

  return {
    pi,
    events,
    commands,
    tools,
    shortcuts,
    messageRenderers,
    sentMessages,
    sentUserMessages,
    entries,
  };
}
