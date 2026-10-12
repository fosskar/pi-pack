---
name: ai-tells
description: Check prose for AI tells (AI slop) or clean them out. Use when the user asks to check, lint, or clean a markdown or text file, README, doc, commit message, or MR description for AI tells, AI slop, or AI-sounding wording.
---

# ai-tells

`ai-tells` runs vale with the ai-tells, ai-tells-commits, and proselint styles and a fixed config. It ignores a repo's own `.vale.ini`. Output is one line per finding:

```text
FILE: docs/intro.md
3:43-47 [error] ai-tells.OverusedVocabulary match="delve" msg="AI vocabulary: 'delve'. Replace with a more specific or common word."
TOTAL: 1 finding(s) (1 error, 0 warning, 0 suggestion) in 1 file(s)
```

Exit 0 means no findings, 1 means findings, 2 means a runtime error.

## run it

- a file or directory: `ai-tells path/to/file.md`
- text without a file: `printf '%s\n' "$text" | ai-tells --ext=.md`
- a commit message: write it to a file named `COMMIT_EDITMSG` in a temp dir and run `ai-tells` on that path; only that file name enables the ai-tells-commits rules

Vale skips code blocks and inline code.

## check

When the user asks to check or review, run `ai-tells` and report the findings grouped by rule, with line numbers. Mark findings you judge to be false positives and say why. Do not edit the file.

## clean

When the user asks to clean or fix, edit the file and rerun `ai-tells` until it exits 0 or every remaining finding is a judged false positive.

- change wording, never claims: keep every fact, number, identifier, path, and command
- fix the sentence, not only the matched word: delete filler, hedges, openers, and closers; replace vague words with the concrete thing
- leave correct text alone even when a rule matches it, e.g. `implement` or `terminate` in technical docs, `TODO` in a real todo list, a quoted error message
- do not add vale suppression comments, edit styles, or rewrite text into something worse to clear a rule
- stop after three rounds and report what is left

Report what changed and every finding left unfixed, with the reason.
