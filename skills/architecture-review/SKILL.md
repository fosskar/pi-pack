---
name: architecture-review
description: Scan a codebase for architecture problems, explain practical improvements in a visual HTML report, then explore whichever one you pick.
disable-model-invocation: true
---

# Architecture Review

Surface architectural friction and propose refactors that gather fragmented responsibilities into cohesive code. The aim is testability and AI-navigability.

Use only the repository's terminology. Derive it from `AGENTS.md`, documentation, and the identifiers used by the code. Do not introduce a glossary or substitute generic architecture labels for repository terms. State what the code does, why it is awkward, and what concrete change would help.

Decision records (`docs/decisions/`, `docs/DECISIONS.md`, or similar) record decisions this command should not re-litigate.

## Process

### 1. Explore

**Choose the scope before you scan.** A refactor pays off when future changes become easier. Give more weight to code that changes frequently.

- If the user names a module, subsystem, or pain point, use that scope.
- Otherwise, inspect a useful span of version history. Start with recurring files and areas. Widen the scan when changes have no clear hot spot.

Read `AGENTS.md` and any decision records in the area you're touching first.

Then use sub-agents to walk the codebase. Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where does a wrapper expose nearly as much complexity as the code behind it?
- Where have pure functions been extracted just for testing, while bugs remain in how callers combine them?
- Where do tightly coupled files require knowledge of each other's internal details?
- Which parts of the codebase are untested, or hard to test through their current entry points?

For a wrapper that appears unnecessary, ask whether deleting it would place related behavior together or merely move the same complexity elsewhere. Only the first outcome supports the refactor.

**Nix repositories:** distinguish imported configuration from reusable library inventory. An unimported module may be intentionally available to downstream users; its lack of local imports is not evidence that it should be deleted.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory so nothing lands in the repo. Resolve the temp dir from `$TMPDIR`, falling back to `/tmp`, and write to `<tmpdir>/architecture-review-<timestamp>.html` so each run gets a fresh file. Open it for the user with `xdg-open <path>` and tell them the absolute path.

The report is **dark mode**, uses **Tailwind via CDN** for layout and styling, and **Mermaid via CDN** for diagrams where a graph/flow/sequence reliably communicates the structure. Mix Mermaid with hand-crafted CSS/SVG visuals — use Mermaid when relationships are graph-shaped (call graphs, dependencies, sequences), and hand-built divs/SVG when you want something more editorial (mass diagrams, cross-sections, collapse animations). Each candidate gets a **before/after visualisation**. Be visual.

For each candidate, render a card with:

- **Files** — which files/modules are involved
- **What happens today** — concrete call/configuration flow, using project names
- **Why this hurts** — the observable cost: scattered changes, hidden coupling, weak tests, or repeated knowledge
- **What would change** — plain English description of the new responsibility and where it would live
- **Why this is better** — concrete effects on changes and tests
- **Before / After diagram** — side-by-side, labelled with concrete actions rather than abstract jargon
- **Recommendation strength** — one of `Strong`, `Worth exploring`, `Speculative`, rendered as a badge

Write as if explaining the finding to a maintainer seeing this area for the first time. Prefer a small example over a definition. Expand acronyms on first use. Keep sentences short, but include enough context to answer: what calls what, what knowledge is duplicated or exposed, and what becomes easier after the change.

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

**Use only the project's own terminology.** If the repository calls something an "aspect module," talk about "the gaming aspect module" — not "the GamingConfigHandler," and not "the gaming service." Do not add architecture terminology that the repository does not use.

**Decision-record conflicts**: if a candidate contradicts an existing decision record, only surface it when the friction is real enough to warrant revisiting the decision. Mark it clearly in the card (e.g. a warning callout: _"contradicts docs/decisions/state-persistence.md — but worth reopening because…"_). Don't list every theoretical refactor a recorded decision forbids.

See [HTML-REPORT.md](HTML-REPORT.md) for the full HTML scaffold, diagram patterns, and styling guidance.

Do NOT propose interfaces yet. After the file is written, ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, run the grilling skill to walk the decision tree with them: constraints, dependencies, the proposed responsibility split, effects on callers, and which tests survive.

Side effects happen inline as decisions crystallize:

- **User rejects the candidate with a load-bearing reason?** Offer a decision record, framed as: _"Want me to record this so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing — skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces?** Produce at least two concrete designs in parallel, compare how each affects callers and tests, and recommend one.
