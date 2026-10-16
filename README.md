# Aegis

A pre-commit guardrail that audits your **staged git diff** for security problems with an LLM, caches verdicts per file-diff so unchanged code is never re-audited, and offers to apply the suggested fix in place. Exit code 1 blocks the commit until the issues are resolved.

```
$ git commit -m "add login endpoint"
Extracting staged changes...

Checking Shadow Gateway cache...
- src/db.ts: PASS (cached)
- src/auth.ts: cache miss

Auditing cache misses with OpenAI...

🚨 Aegis Security Audit: FAILED. Vulnerabilities detected:

[Issue #1]
  Vulnerability: SQL query built with string concatenation from req.body.email (SQL injection).
  Suggested Fix: Use a parameterized query.
  File: src/auth.ts

? Would you like to automatically apply this fix to src/auth.ts? (y/N)
```

## What it checks

Exposed secrets, injection (SQL/command), auth and logic flaws, unsafe dependency usage, and similar issues in the lines you are about to commit. The model is asked for a strict JSON verdict with, for each issue, the exact `target_code` and a `replacement_code`, which is what makes one-keystroke fixes possible.

## Install

```bash
git clone https://github.com/JustFady/Aegis.git && cd Aegis
npm install && npm run build
npm link            # puts `aegis` on your PATH
aegis config set-key sk-...   # or export OPENAI_API_KEY
```

## Use

```bash
git add -A
aegis audit         # audits only what is staged
```

As a pre-commit hook:

```bash
printf '#!/bin/sh\nexec aegis audit\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

If you accept an auto-fix, Aegis rewrites the file, re-stages it, and still exits 1 so you review the change before committing again.

## How the cache works

Each staged file's diff block is hashed; verdicts (`pass`/`fail` plus issues) are stored in a local SQLite database (`better-sqlite3`). Re-running on the same staged changes costs nothing and takes milliseconds; only new or changed hunks go to the model. Diffs are sent in one combined request to keep latency and cost low.

## Configuration

| Setting | How |
|---|---|
| API key | `aegis config set-key <key>` (stored locally) or `OPENAI_API_KEY` |
| Model | `gpt-4o-mini`, temperature 0.1, JSON-mode responses (see `src/services/openai.ts`) |

## Limitations

- It audits the diff, not the whole repository; context outside the hunk is not seen.
- LLM verdicts are advisory. Treat a PASS as "nothing obvious in this diff", not as a security review.
- Requires an OpenAI key; other providers are not wired up yet.

## Development

```bash
npm run typecheck && npm run lint && npm run build
```

TypeScript, `commander`, `inquirer`, `chalk`, `better-sqlite3`, bundled with `tsup`.

## License

MIT © Fady Youssef
