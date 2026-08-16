---
name: code-review
description: Review the changes since a fixed point (commit, branch, tag, bookmark, or merge-base) against this repo's documented standards plus a fixed baseline of code and operational smells. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Standards review of the diff between the working copy and a fixed point the user supplies: does the code follow this repo's documented standards, and does it avoid a fixed baseline of smells?

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit, branch, bookmark, tag, `main`, `HEAD~5`. If they did not name one, ask.

Detect the version control system, then capture the diff and the commit list once:

- jj (`.jj/` exists): `jj diff --from <fixed-point>` and `jj log -r '<fixed-point>..@'`
- git: `git diff <fixed-point>...HEAD` and `git log <fixed-point>..HEAD --oneline`

Use three dots for git, so the comparison runs against the merge base.

Confirm the fixed point resolves and the diff is not empty before going further. A bad reference or an empty diff fails here.

### 2. Identify the standards sources

Read whatever the repo uses to document how code must be written: `AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/`, or a linter configuration that encodes a decision.

The repo's own conventions also count when they are visible in the surrounding code, even when nobody wrote them down. Prefer a written rule over an inferred one, and say which kind you used.

### 3. Carry the baselines

Two fixed baselines apply on top of the repo's own standards, even when the repo documents nothing. Three rules bind them:

- **The repo overrides.** A documented repo standard always wins. Where it endorses something a baseline would flag, suppress the finding.
- **Always a judgement call.** Every baseline entry is a labelled heuristic ("possible Feature Envy"), never a hard violation.
- **Skip what tooling enforces.** A formatter, linter, or type checker already reports its own findings.

#### Code smells

From Fowler, _Refactoring_, chapter 3. Each entry reads _what it is_ → _how to fix_.

- **Mysterious Name** — a function, variable, or type whose name does not reveal what it does or holds. → rename it; if no honest name comes, the design is murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or parameters keep travelling together. → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string stands in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same switch or if-cascade on the same type recurs across the change. → replace with polymorphism, or one shared map.
- **Shotgun Surgery** — one logical change forces scattered edits across many files. → gather what changes together into one place.
- **Divergent Change** — one file is edited for several unrelated reasons. → split it so each part changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the task does not have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller should not depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a unit that mostly delegates onward. → cut it, call the real target directly.
- **Refused Bequest** — a subclass or implementer that ignores most of what it inherits. → drop the inheritance, use composition.

#### Operational smells

These apply to any change that touches how software runs: application code, container images, orchestration manifests, service units, and infrastructure definitions.

- **Secret in the diff** — a token, key, password, or certificate in plain text, in an environment default, or in a build artifact. → route it through the repo's existing secret mechanism, and rotate the exposed value.
- **Privilege widening** — a process moves to a more powerful account, gains capabilities, drops a sandbox setting, or mounts more of the host. → justify it in the change, or narrow it back.
- **Unintended exposure** — a new listener on all interfaces, an opened firewall port, or a public route where the repo reaches services through an existing proxy. → bind locally and go through the established path.
- **Missing way back** — a data migration, a format change, or a deletion of persisted state with no stated rollback. → state how to reverse it, or gate it behind a flag.
- **Unbounded work** — a new loop, query, retry, or fetch with no limit, timeout, or page size. → give it a bound.
- **Silent failure** — a swallowed error, an empty fallback, or a catch that hides the cause. → fail loudly, or record why the failure is safe.

### 4. Review

Walk the diff against the standards sources and both baselines. For each file or hunk that deserves a finding, report:

- every place the change breaks a documented standard: name the standard, cite the file and rule;
- every baseline smell you see: name it and quote the hunk.

Separate hard violations from judgement calls. A documented standard can be a hard violation; a baseline entry never is.

For a large diff, run the walk in a sub-agent so it does not fill the main context. Paste both baselines into the sub-agent prompt in full — it has no other access to them.

### 5. Report

Group findings by file, hard violations before judgement calls. End with one line: the number of findings and the worst one.
