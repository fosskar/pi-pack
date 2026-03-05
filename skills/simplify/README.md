# simplify

reviews your recently changed files for code reuse, quality, and efficiency issues, then fixes them.

run after implementing a feature or bug fix to clean up your work. pass optional text to focus on specific concerns (e.g. `/skill:simplify focus on memory efficiency`).

performs three reviews:
- **code reuse** — finds existing utilities that could replace new code
- **code quality** — flags redundant state, parameter sprawl, copy-paste, leaky abstractions, stringly-typed code
- **efficiency** — catches unnecessary work, missed concurrency, hot-path bloat, TOCTOU anti-patterns, memory leaks
