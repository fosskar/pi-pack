import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import llmWikiExtension, {
  discoverWikiPath,
  GitWikiRepository,
  type GitRunner,
} from "../index.ts";
import { createMockPi } from "../../../nix/test/helpers.ts";

const runGit: GitRunner = async (args, options) => {
  const child = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Pi Pack Test",
      GIT_AUTHOR_EMAIL: "pi-pack@example.invalid",
      GIT_COMMITTER_NAME: "Pi Pack Test",
      GIT_COMMITTER_EMAIL: "pi-pack@example.invalid",
      GIT_TERMINAL_PROMPT: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
    signal: options.signal,
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
};

async function git(args: string[], cwd: string): Promise<string> {
  const result = await runGit(args, { cwd });
  if (result.code !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

async function fixture(root: string) {
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const clone = join(root, "llm-wiki");

  await git(["init", "--bare", remote], root);
  await git(["clone", remote, seed], root);
  await git(["switch", "-c", "main"], seed);
  await mkdir(join(seed, "raw"), { recursive: true });
  await mkdir(join(seed, "wiki"), { recursive: true });
  await writeFile(join(seed, "raw", ".gitkeep"), "");
  await writeFile(join(seed, "SPEC.md"), "# Wiki format\n");
  await writeFile(join(seed, "wiki", "index.md"), "# Wiki\n");
  await git(["add", "raw/.gitkeep", "SPEC.md", "wiki/index.md"], seed);
  await git(["commit", "-m", "seed wiki"], seed);
  await git(["push", "-u", "origin", "main"], seed);
  await git(["symbolic-ref", "HEAD", "refs/heads/main"], remote);

  return {
    remote,
    clone,
    repository: new GitWikiRepository(
      { path: clone, remote, branch: "main" },
      runGit,
    ),
  };
}

async function expectFailure(
  work: Promise<unknown>,
  message: string,
): Promise<void> {
  try {
    await work;
    assert.fail(`Expected failure containing: ${message}`);
  } catch (error) {
    assert.match(
      error instanceof Error ? error.message : String(error),
      new RegExp(message),
    );
  }
}

export default async function (): Promise<void> {
  const mock = createMockPi();
  llmWikiExtension(mock.pi as never);
  assert.deepEqual([...mock.tools.keys()], ["llm_wiki"]);
  assert.deepEqual(
    [...mock.commands.keys()],
    ["wiki-capture", "wiki-query", "wiki-observe", "wiki-lint", "wiki-status"],
  );
  await mock.commands.get("wiki-query")!.handler("stored knowledge", {
    hasUI: false,
  });
  assert.match(String(mock.sentUserMessages[0]), /stored knowledge/);

  const root = await mkdtemp(join(tmpdir(), "pi-pack-llm-wiki-test-"));
  try {
    const { remote, clone, repository } = await fixture(root);

    const status = await repository.status();
    assert.equal(status.branch, "main");
    assert.deepEqual(status.guidanceFiles, ["SPEC.md"]);
    assert.equal(await discoverWikiPath(root), clone);

    const initial = await repository.read(["wiki/index.md"]);
    assert.equal(initial.files[0].content, "# Wiki\n");

    const hook = join(clone, ".git", "hooks", "pre-commit");
    await writeFile(
      hook,
      "#!/bin/sh\nprintf 'hook mutation\\n' > wiki/hook.md\ngit add wiki/hook.md\n",
    );
    await chmod(hook, 0o755);

    const result = await repository.apply(
      "observation",
      "wiki: remember editor preference",
      [
        {
          path: "raw/sources/editor-preference.md",
          role: "source",
          content: "I prefer modal editors.\n",
        },
        {
          path: "wiki/sources/editor-preference.md",
          role: "concept",
          content:
            "---\ntype: Source\ntitle: Editor preference\n---\n\n# Editor preference\n\nThe user prefers modal editors.\n",
        },
        {
          path: "wiki/index.md",
          role: "index",
          expected_sha256: initial.files[0].sha256,
          content:
            "# Wiki\n\n- [Editor preference](sources/editor-preference.md)\n",
        },
      ],
    );

    assert.deepEqual(result.changedPaths, [
      "raw/sources/editor-preference.md",
      "wiki/index.md",
      "wiki/sources/editor-preference.md",
    ]);
    assert.match(
      await readFile(join(clone, "wiki", "index.md"), "utf8"),
      /Editor preference/,
    );

    const verify = join(root, "verify");
    await git(["clone", remote, verify], root);
    assert.match(
      await readFile(
        join(verify, "wiki", "sources", "editor-preference.md"),
        "utf8",
      ),
      /modal editors/,
    );
    await expectFailure(
      readFile(join(verify, "wiki", "hook.md"), "utf8"),
      "ENOENT",
    );

    await expectFailure(
      repository.apply("ingest", "wiki: reject misplaced source", [
        {
          path: "wiki/misplaced-source.md",
          role: "source",
          content: "source\n",
        },
      ]),
      "source role requires a raw/ path",
    );

    await expectFailure(
      repository.apply("query-note", "wiki: reject malformed note", [
        {
          path: "wiki/notes/malformed.md",
          role: "concept",
          content: "---\ntype: Note\n\nMissing closing delimiter.\n",
        },
      ]),
      "requires valid frontmatter",
    );

    await expectFailure(
      repository.apply("query-note", "wiki: add stale note", [
        {
          path: "wiki/index.md",
          role: "index",
          expected_sha256: "0".repeat(64),
          content: "# Changed\n",
        },
      ]),
      "File changed since it was read",
    );

    await expectFailure(
      repository.apply("ingest", "wiki: reject raw update", [
        {
          path: "raw/sources/editor-preference.md",
          role: "source",
          expected_sha256: "0".repeat(64),
          content: "changed\n",
        },
      ]),
      "Source material is immutable",
    );

    const outside = join(root, "outside.md");
    await writeFile(outside, "outside\n");
    await symlink(outside, join(clone, "wiki", "link.md"));
    await git(["add", "wiki/link.md"], clone);
    await git(["commit", "-m", "add test symbolic link"], clone);
    await git(["push"], clone);
    await expectFailure(
      repository.apply("query-note", "wiki: reject symbolic link", [
        {
          path: "wiki/link.md",
          role: "concept",
          expected_sha256: "0".repeat(64),
          content: "changed\n",
        },
      ]),
      "symbolic link",
    );
    await git(["rm", "wiki/link.md"], clone);
    await git(["commit", "-m", "remove test symbolic link"], clone);
    await git(["push"], clone);

    const lockPath = `${clone}.llm-wiki-lock`;
    await mkdir(lockPath);
    await expectFailure(repository.status(), "holds the lock");
    await rm(lockPath, { recursive: true });

    await writeFile(join(clone, "untracked.md"), "dirty\n");
    await expectFailure(repository.status(), "uncommitted changes");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
