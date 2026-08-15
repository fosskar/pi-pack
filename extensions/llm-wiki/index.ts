import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { randomUUID, createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const MAX_READ_FILES = 20;
const MAX_READ_BYTES = 50 * 1024;
const MAX_SEARCH_BYTES = 50 * 1024;
const MAX_APPLY_FILES = 32;
const MAX_APPLY_BYTES = 512 * 1024;
const GUIDANCE_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "SPEC.md",
  "WIKI_SCHEMA.md",
  "llm-wiki.md",
] as const;

export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
}

export type GitRunner = (
  args: string[],
  options: { cwd?: string; signal?: AbortSignal; timeout?: number },
) => Promise<GitResult>;

export interface WikiConfig {
  path: string;
  remote?: string;
  branch: string;
}

export type WikiFileRole = "source" | "concept" | "index" | "log" | "schema";

export interface WikiChange {
  path: string;
  role: WikiFileRole;
  content: string;
  expected_sha256?: string;
}

function textResult(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: "text" as const, text }], details };
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function truncate(text: string, limit: number): string {
  if (Buffer.byteLength(text) <= limit) return text;
  let end = text.length;
  while (end > 0 && Buffer.byteLength(text.slice(0, end)) > limit) end -= 1024;
  return `${text.slice(0, Math.max(0, end))}\n\n[Output truncated at ${limit} bytes.]`;
}

function validateRelativePath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (
    !normalized ||
    isAbsolute(normalized) ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized === ".git" ||
    normalized.startsWith(".git/") ||
    normalized.includes("\0")
  ) {
    throw new Error(`Invalid wiki path: ${path}`);
  }
  return normalized.replace(/^\.\//, "");
}

async function canonicalizePath(path: string): Promise<string> {
  let current = path;
  const missing: string[] = [];
  while (true) {
    try {
      return join(await realpath(current), ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      missing.push(basename(current));
      current = parent;
    }
  }
}

async function assertNoSymlinkPath(root: string, path: string): Promise<void> {
  const target = resolve(root, path);
  const relation = relative(root, target);
  if (relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`Wiki path escapes the clone: ${path}`);
  }

  let current = root;
  for (const part of relation.split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`Wiki path crosses a symbolic link: ${path}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

async function isWikiRepository(path: string): Promise<boolean> {
  try {
    const git = await lstat(join(path, ".git"));
    return (
      basename(path) === "llm-wiki" &&
      (git.isDirectory() || git.isFile()) &&
      (await lstat(join(path, "raw"))).isDirectory() &&
      (await lstat(join(path, "wiki"))).isDirectory()
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function discoverWikiPath(start: string): Promise<string> {
  const candidates = new Set<string>();
  let directory = resolve(start);
  while (true) {
    for (const candidate of [directory, join(directory, "llm-wiki")]) {
      if (await isWikiRepository(candidate)) {
        candidates.add(await realpath(candidate));
      }
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  if (candidates.size === 0) {
    throw new Error(
      "No llm-wiki Git repository with raw/ and wiki/ was found. " +
        "Run Pi in or near the repository, or set LLM_WIKI_PATH.",
    );
  }
  if (candidates.size > 1) {
    throw new Error(
      `Several llm-wiki repositories were found; set LLM_WIKI_PATH: ${[...candidates].join(", ")}`,
    );
  }
  return [...candidates][0];
}

async function configFromEnvironment(): Promise<WikiConfig> {
  const configuredPath = process.env.LLM_WIKI_PATH;
  const path = configuredPath
    ? resolve(configuredPath.replace(/^~(?=$|\/)/, homedir()))
    : await discoverWikiPath(process.cwd());
  if (basename(path) !== "llm-wiki") {
    throw new Error(`Wiki repository must be named llm-wiki: ${path}`);
  }
  return {
    path,
    remote: process.env.LLM_WIKI_REMOTE,
    branch: process.env.LLM_WIKI_BRANCH || "main",
  };
}

export class GitWikiRepository {
  constructor(
    private readonly config: WikiConfig,
    private readonly runGit: GitRunner,
  ) {}

  async status(signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this.withLock(async () => {
      await this.ensureClone(signal);
      const commit = await this.synchronize(signal);
      const upstream = await this.gitText(
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        this.config.path,
        signal,
      );
      const guidanceFiles: string[] = [];
      for (const path of GUIDANCE_FILES) {
        try {
          if ((await lstat(join(this.config.path, path))).isFile()) {
            guidanceFiles.push(path);
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      return {
        path: this.config.path,
        branch: this.config.branch,
        upstream,
        commit,
        guidanceFiles,
      };
    });
  }

  async read(paths: string[], signal?: AbortSignal) {
    if (paths.length === 0 || paths.length > MAX_READ_FILES) {
      throw new Error(`read requires 1-${MAX_READ_FILES} paths`);
    }
    return this.withLock(async () => {
      await this.ensureClone(signal);
      const commit = await this.synchronize(signal);
      const files = [];
      let bytes = 0;
      for (const input of paths) {
        const path = validateRelativePath(input);
        await assertNoSymlinkPath(this.config.path, path);
        const content = await readFile(join(this.config.path, path), "utf8");
        bytes += Buffer.byteLength(content);
        if (bytes > MAX_READ_BYTES) {
          throw new Error(
            `read result exceeds ${MAX_READ_BYTES} bytes; request fewer files`,
          );
        }
        files.push({ path, sha256: sha256(content), content });
      }
      return { commit, files };
    });
  }

  async search(
    query: string,
    paths: string[] | undefined,
    signal?: AbortSignal,
  ) {
    if (!query.trim()) throw new Error("search requires a non-empty query");
    return this.withLock(async () => {
      await this.ensureClone(signal);
      const commit = await this.synchronize(signal);
      const pathspecs = paths?.map(validateRelativePath) ?? [];
      const result = await this.runGit(
        ["grep", "-Fni", "--", query, ...pathspecs],
        { cwd: this.config.path, signal, timeout: 15_000 },
      );
      if (result.killed) throw new Error("git grep was cancelled or timed out");
      if (result.code !== 0 && result.code !== 1) {
        throw new Error(`git grep failed: ${result.stderr.trim()}`);
      }
      return {
        commit,
        matches: truncate(result.stdout.trim(), MAX_SEARCH_BYTES),
      };
    });
  }

  async apply(
    operation: string,
    message: string,
    changes: WikiChange[],
    signal?: AbortSignal,
  ) {
    this.validateApplyInput(operation, message, changes);
    return this.withLock(async () => {
      await this.ensureClone(signal);
      const baseCommit = await this.synchronize(signal);
      const worktree = await mkdtemp(join(tmpdir(), "pi-llm-wiki-"));
      let publishedCommit: string | undefined;

      try {
        await this.git(
          ["worktree", "add", "--detach", worktree, baseCommit],
          this.config.path,
          signal,
        );
        for (const change of changes) await this.writeChange(worktree, change);

        const changedPaths = changes.map((change) =>
          validateRelativePath(change.path),
        );
        await this.git(["add", "--", ...changedPaths], worktree, signal);
        const staged = await this.gitText(
          ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
          worktree,
          signal,
        );
        const actualPaths = staged.split("\n").filter(Boolean).sort();
        const expectedPaths = [...new Set(changedPaths)].sort();
        if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
          throw new Error(
            "The staged change set does not match the requested wiki files",
          );
        }

        await this.validateWorktree(worktree, changes, signal);
        await this.git(
          ["-c", "core.hooksPath=/dev/null", "commit", "-m", message],
          worktree,
          signal,
        );
        publishedCommit = await this.gitText(
          ["rev-parse", "HEAD"],
          worktree,
          signal,
        );
        const committedPaths = (
          await this.gitText(
            [
              "diff-tree",
              "--no-commit-id",
              "--name-only",
              "-r",
              publishedCommit,
            ],
            worktree,
            signal,
          )
        )
          .split("\n")
          .filter(Boolean)
          .sort();
        if (JSON.stringify(committedPaths) !== JSON.stringify(expectedPaths)) {
          throw new Error(
            "The committed change set does not match the requested wiki files",
          );
        }

        const upstream = await this.upstream(this.config.path, signal);
        await this.git(
          [
            "push",
            upstream.remote,
            `${publishedCommit}:refs/heads/${upstream.branch}`,
          ],
          worktree,
          signal,
          60_000,
        );

        let reconciliationWarning: string | undefined;
        try {
          await this.git(
            ["fetch", upstream.remote, upstream.branch],
            this.config.path,
          );
          await this.git(
            ["merge", "--ff-only", publishedCommit],
            this.config.path,
          );
        } catch (error) {
          reconciliationWarning =
            "The push succeeded, but the local clone was not advanced: " +
            (error instanceof Error ? error.message : String(error));
        }

        return {
          operation,
          baseCommit,
          commit: publishedCommit,
          changedPaths: actualPaths,
          reconciliationWarning,
        };
      } finally {
        try {
          const removal = await this.runGit(
            ["worktree", "remove", "--force", worktree],
            { cwd: this.config.path, timeout: 15_000 },
          );
          if (removal.code !== 0) {
            await this.runGit(["worktree", "prune"], {
              cwd: this.config.path,
              timeout: 15_000,
            });
          }
          await rm(worktree, { recursive: true, force: true });
        } catch (error) {
          console.error("llm-wiki: failed to remove temporary worktree", error);
        }
      }
    });
  }

  private validateApplyInput(
    operation: string,
    message: string,
    changes: WikiChange[],
  ): void {
    if (!operation.trim()) throw new Error("apply requires an operation name");
    if (!message.trim() || message.includes("\n") || message.length > 72) {
      throw new Error(
        "apply message must be one non-empty line of at most 72 characters",
      );
    }
    if (changes.length === 0 || changes.length > MAX_APPLY_FILES) {
      throw new Error(`apply requires 1-${MAX_APPLY_FILES} files`);
    }
    const paths = changes.map((change) => validateRelativePath(change.path));
    if (new Set(paths).size !== paths.length)
      throw new Error("apply contains duplicate paths");
    for (const [index, change] of changes.entries()) {
      const path = paths[index];
      if (change.role === "source" && !path.startsWith("raw/")) {
        throw new Error(`A source role requires a raw/ path: ${path}`);
      }
      if (
        ["concept", "index", "log"].includes(change.role) &&
        !path.startsWith("wiki/")
      ) {
        throw new Error(`${change.role} role requires a wiki/ path: ${path}`);
      }
      if (
        change.role === "schema" &&
        !GUIDANCE_FILES.includes(path as (typeof GUIDANCE_FILES)[number])
      ) {
        throw new Error(
          `A schema role requires a known root schema path: ${path}`,
        );
      }
      if (
        !["source", "concept", "index", "log", "schema"].includes(change.role)
      ) {
        throw new Error(`Unknown wiki file role: ${change.role}`);
      }
    }
    const bytes = changes.reduce(
      (sum, change) => sum + Buffer.byteLength(change.content),
      0,
    );
    if (bytes > MAX_APPLY_BYTES) {
      throw new Error(`apply content exceeds ${MAX_APPLY_BYTES} bytes`);
    }
  }

  private async writeChange(
    worktree: string,
    change: WikiChange,
  ): Promise<void> {
    const path = validateRelativePath(change.path);
    await assertNoSymlinkPath(worktree, path);
    const target = join(worktree, path);
    let current: string | undefined;
    try {
      current = await readFile(target, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    if (current === undefined) {
      if (change.expected_sha256 !== undefined) {
        throw new Error(`Expected existing file is missing: ${path}`);
      }
    } else {
      if (change.role === "source") {
        throw new Error(`Source material is immutable: ${path}`);
      }
      if (!change.expected_sha256) {
        throw new Error(`Existing file requires expected_sha256: ${path}`);
      }
      if (sha256(current) !== change.expected_sha256) {
        throw new Error(`File changed since it was read: ${path}`);
      }
    }

    await mkdir(dirname(target), { recursive: true });
    const temporary = join(
      dirname(target),
      `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`,
    );
    const handle = await open(
      temporary,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    try {
      await handle.writeFile(change.content, "utf8");
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
    if (!(await lstat(target)).isFile()) {
      throw new Error(`Wiki path is not a regular file: ${path}`);
    }
  }

  private async validateWorktree(
    worktree: string,
    changes: WikiChange[],
    signal?: AbortSignal,
  ): Promise<void> {
    for (const change of changes) {
      const path = validateRelativePath(change.path);
      if (change.role === "source") continue;
      if (!path.endsWith(".md")) {
        throw new Error(
          `${change.role} files must use the .md suffix: ${path}`,
        );
      }
      if (
        change.role === "index" &&
        basename(path).toLowerCase() !== "index.md"
      ) {
        throw new Error(
          `An index role requires the reserved index.md name: ${path}`,
        );
      }
      if (change.role === "log" && basename(path).toLowerCase() !== "log.md") {
        throw new Error(
          `A log role requires the reserved log.md name: ${path}`,
        );
      }
      if (change.role !== "concept") continue;

      const content = await readFile(join(worktree, path), "utf8");
      const closing = content.indexOf("\n---\n", 4);
      const frontmatter = closing < 0 ? "" : content.slice(4, closing);
      const type = frontmatter.match(/^type:\s*(.+)$/m)?.[1]?.trim();
      if (!type || type.startsWith("#")) {
        throw new Error(
          `OKF concept requires valid frontmatter with type: ${path}`,
        );
      }
    }
    await this.git(["diff", "--cached", "--check"], worktree, signal);
  }

  private async ensureClone(signal?: AbortSignal): Promise<void> {
    if (basename(this.config.path) !== "llm-wiki") {
      throw new Error(
        `Wiki repository must be named llm-wiki: ${this.config.path}`,
      );
    }
    try {
      await lstat(join(this.config.path, ".git"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (!this.config.remote) {
        throw new Error(
          `Wiki clone does not exist and LLM_WIKI_REMOTE is not set: ${this.config.path}`,
        );
      }
      await mkdir(dirname(this.config.path), { recursive: true });
      await this.git(
        [
          "clone",
          "--branch",
          this.config.branch,
          "--single-branch",
          this.config.remote,
          this.config.path,
        ],
        dirname(this.config.path),
        signal,
        60_000,
      );
    }
    for (const directory of ["raw", "wiki"]) {
      if (!(await lstat(join(this.config.path, directory))).isDirectory()) {
        throw new Error(`Wiki repository requires a ${directory}/ directory`);
      }
    }
  }

  private async synchronize(signal?: AbortSignal): Promise<string> {
    const status = await this.gitText(
      ["status", "--porcelain=v1", "--untracked-files=all"],
      this.config.path,
      signal,
    );
    if (status)
      throw new Error(
        "Wiki clone has uncommitted changes; resolve them before continuing",
      );

    const branch = await this.gitText(
      ["branch", "--show-current"],
      this.config.path,
      signal,
    );
    if (branch !== this.config.branch) {
      throw new Error(
        `Wiki clone is on ${branch || "detached HEAD"}; expected ${this.config.branch}`,
      );
    }

    const upstream = await this.upstream(this.config.path, signal);
    if (this.config.remote) {
      const actualRemote = await this.gitText(
        ["remote", "get-url", upstream.remote],
        this.config.path,
        signal,
      );
      if (actualRemote !== this.config.remote) {
        throw new Error(
          `Wiki remote mismatch: expected ${this.config.remote}, got ${actualRemote}`,
        );
      }
    }

    await this.git(
      ["fetch", "--prune", upstream.remote, upstream.branch],
      this.config.path,
      signal,
      60_000,
    );
    const local = await this.gitText(
      ["rev-parse", "HEAD"],
      this.config.path,
      signal,
    );
    const remote = await this.gitText(
      ["rev-parse", `refs/remotes/${upstream.remote}/${upstream.branch}`],
      this.config.path,
      signal,
    );
    if (local !== remote) {
      const ancestor = await this.runGit(
        ["merge-base", "--is-ancestor", local, remote],
        {
          cwd: this.config.path,
          signal,
          timeout: 15_000,
        },
      );
      if (ancestor.code !== 0) {
        throw new Error(
          "Wiki clone is ahead of or diverged from its upstream branch",
        );
      }
      await this.git(["merge", "--ff-only", remote], this.config.path, signal);
    }
    return this.gitText(["rev-parse", "HEAD"], this.config.path, signal);
  }

  private async upstream(
    cwd: string,
    signal?: AbortSignal,
  ): Promise<{ remote: string; branch: string }> {
    const value = await this.gitText(
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      cwd,
      signal,
    );
    const separator = value.indexOf("/");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`Unsupported wiki upstream: ${value}`);
    }
    return {
      remote: value.slice(0, separator),
      branch: value.slice(separator + 1),
    };
  }

  private async git(
    args: string[],
    cwd: string,
    signal?: AbortSignal,
    timeout = 30_000,
  ): Promise<GitResult> {
    const result = await this.runGit(args, { cwd, signal, timeout });
    if (result.killed)
      throw new Error(`git ${args[0]} was cancelled or timed out`);
    if (result.code !== 0) {
      const detail = truncate(
        result.stderr.trim() || result.stdout.trim(),
        MAX_READ_BYTES,
      );
      throw new Error(`git ${args[0]} failed: ${detail}`);
    }
    return result;
  }

  private async gitText(
    args: string[],
    cwd: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return (await this.git(args, cwd, signal)).stdout.trim();
  }

  private async withLock<T>(work: () => Promise<T>): Promise<T> {
    const canonicalPath = await canonicalizePath(this.config.path);
    const lockPath = `${canonicalPath}.llm-wiki-lock`;
    await mkdir(dirname(lockPath), { recursive: true });
    try {
      await mkdir(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(
          `Another wiki operation holds the lock: ${lockPath}. Remove it manually only after verifying that no operation is running.`,
        );
      }
      throw error;
    }
    try {
      await writeFile(
        join(lockPath, "owner.json"),
        `${JSON.stringify({ pid: process.pid, started: new Date().toISOString() })}\n`,
      );
      return await work();
    } finally {
      try {
        await rm(lockPath, { recursive: true });
      } catch (error) {
        console.error("llm-wiki: failed to remove operation lock", error);
      }
    }
  }
}

export default function llmWikiExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "llm_wiki",
    label: "LLM Wiki",
    description:
      "Synchronize, search, read, or atomically update a Git-backed LLM wiki. " +
      "Mutations validate, commit, and push one complete operation. Output is limited to 50KB.",
    promptSnippet: "Read and update the configured Git-backed LLM wiki",
    promptGuidelines: [
      "Use llm_wiki when the user asks to capture, ingest, query, or lint wiki knowledge, or to preserve a durable personal fact.",
      "Use llm_wiki for wiki repository access instead of direct Git commands or direct file mutation.",
      "Follow the Karpathy LLM Wiki pattern: preserve source material, maintain derived knowledge separately, search before creating pages, integrate new evidence, and keep provenance.",
      "Write OKF v0.2 concept documents as Markdown with YAML frontmatter and a non-empty type; preserve unknown types and fields, and use index.md and log.md only as reserved documents.",
      "Start each semantic operation with llm_wiki status, then read every reported guidance file before other wiki content.",
      "The repository is named llm-wiki; preserve immutable source material under raw/ and derived knowledge under wiki/.",
      "For llm_wiki apply, label each file as source, concept, index, log, or schema and submit every file for one complete semantic operation.",
      "Preserve only non-sensitive personal facts stated by the user; never store secrets or inferred sensitive facts.",
    ],
    parameters: Type.Object({
      action: StringEnum(["status", "search", "read", "apply"] as const),
      query: Type.Optional(
        Type.String({ description: "Fixed-string search query" }),
      ),
      paths: Type.Optional(
        Type.Array(Type.String(), { maxItems: MAX_READ_FILES }),
      ),
      operation: Type.Optional(
        StringEnum([
          "capture",
          "ingest",
          "observation",
          "query-note",
          "lint-fix",
        ] as const),
      ),
      message: Type.Optional(Type.String({ maxLength: 72 })),
      files: Type.Optional(
        Type.Array(
          Type.Object({
            path: Type.String(),
            role: StringEnum([
              "source",
              "concept",
              "index",
              "log",
              "schema",
            ] as const),
            content: Type.String(),
            expected_sha256: Type.Optional(Type.String()),
          }),
          { maxItems: MAX_APPLY_FILES },
        ),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const config = await configFromEnvironment();
      const repository = new GitWikiRepository(config, (args, options) =>
        pi.exec("git", args, options),
      );

      if (params.action === "status") {
        const status = await repository.status(signal);
        return textResult(
          `Wiki synchronized at ${status.commit}\nPath: ${status.path}\nUpstream: ${status.upstream}\nGuidance: ${((status.guidanceFiles as string[]) ?? []).join(", ") || "none"}`,
          status,
        );
      }
      if (params.action === "search") {
        const result = await repository.search(
          params.query ?? "",
          params.paths,
          signal,
        );
        return textResult(result.matches || "No matches found.", result);
      }
      if (params.action === "read") {
        const result = await repository.read(params.paths ?? [], signal);
        const rendered = result.files
          .map(
            (file) =>
              `## ${file.path}\nsha256: ${file.sha256}\n\n${file.content}`,
          )
          .join("\n\n");
        return textResult(rendered, result);
      }
      if (params.action === "apply") {
        const result = await repository.apply(
          params.operation ?? "",
          params.message ?? "",
          params.files ?? [],
          signal,
        );
        const warning = result.reconciliationWarning
          ? `\nWarning: ${result.reconciliationWarning}`
          : "";
        return textResult(
          `Wiki operation pushed as ${result.commit}\nChanged: ${result.changedPaths.join(", ")}${warning}`,
          result,
        );
      }
      throw new Error(`Unsupported llm_wiki action: ${params.action}`);
    },
  });

  const registerWorkflowCommand = (
    name: string,
    description: string,
    instruction: (args: string) => string,
    requiresArgument = true,
  ) => {
    pi.registerCommand(name, {
      description,
      handler: async (args, ctx) => {
        const value = (args ?? "").trim();
        if (requiresArgument && !value) {
          if (ctx.hasUI)
            ctx.ui.notify(`/${name} requires an argument`, "error");
          return;
        }
        pi.sendUserMessage(instruction(value));
      },
    });
  };

  registerWorkflowCommand(
    "wiki-capture",
    "Capture and ingest a source into the Git-backed LLM wiki",
    (source) =>
      `Capture and ingest this source into the LLM wiki: ${source}\nUse llm_wiki only for repository access. Call status and read every reported guidance file first. Follow the built-in Karpathy and OKF workflow. Submit the complete operation with one apply action.`,
  );
  registerWorkflowCommand(
    "wiki-query",
    "Answer a question from the Git-backed LLM wiki",
    (question) =>
      `Answer this question from the LLM wiki: ${question}\nUse llm_wiki to call status and read every reported guidance file first. Then search and read the supporting pages. Keep the query read-only unless I explicitly request a filed note.`,
  );
  registerWorkflowCommand(
    "wiki-observe",
    "Preserve a durable personal fact in the Git-backed LLM wiki",
    (observation) =>
      `Preserve this user-stated observation in the LLM wiki: ${observation}\nUse llm_wiki only for repository access. Call status and read every reported guidance file first. Do not infer or store sensitive facts. Submit the complete operation with one observation apply action.`,
  );
  registerWorkflowCommand(
    "wiki-lint",
    "Inspect the Git-backed LLM wiki without changing it",
    () =>
      "Lint the LLM wiki. Use llm_wiki to call status and read every reported guidance file first. Inspect its OKF concepts, links, indexes, logs, and provenance. Report findings only. Do not apply fixes.",
    false,
  );
  registerWorkflowCommand(
    "wiki-status",
    "Synchronize and show the Git-backed LLM wiki status",
    () => "Call llm_wiki with the status action and report the result.",
    false,
  );
}
