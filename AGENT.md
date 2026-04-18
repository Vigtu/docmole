# CLAUDE.md

Guidance for Claude Code (and other CLI agents) working in this repository.

## What docmole is

A retrieval-only CLI that mirrors any documentation site to local markdown,
builds a BM25 index, and ships a skill package so consuming agents discover
and use it automatically. No embedded LLM. No embeddings. No API keys. The
agent that calls docmole does all semantic work.

## Commands

```bash
bun install          # Install deps (Bun is dev-time only; publish targets Node)
bun run dev          # Run src/index.ts with hot reload
bun run test         # bun test (all files in tests/)
bun run typecheck    # tsc --noEmit
bun run lint         # biome check --write
bun run build        # Bundle dist/cli.js for Node target (scripts/build.ts)
```

Single test: `bun test tests/search.test.ts`

## Architecture

Three layers, each a thin module:

```
┌──────────────────────────────────────────────────────┐
│                       CLI                             │
│              src/index.ts (arg parsing)               │
│    setup · search · install · list · --help           │
└────────────────┬────────────────┬────────────────────┘
                 │                │
     ┌───────────▼──────┐    ┌────▼──────────────┐
     │    Discovery     │    │     Search        │
     │  src/discovery/  │    │   src/search/     │
     │                  │    │                   │
     │  llms-full.txt → │    │  BM25 scorer      │
     │  sitemap.xml →   │    │  index builder    │
     │  mint.json       │    │  query + snippet  │
     └─────┬────────────┘    └───────────────────┘
           │
     ┌─────▼─────────┐
     │    Crawler    │
     │  src/crawler/ │
     │               │
     │  inline →     │
     │  .md fastpath │
     │  HTML fallback│
     │  (Readability │
     │   + Turndown) │
     └───────────────┘
```

## Core flow

```
setup(url, id)
  ├─ discovery: try llms-full.txt; fall through to sitemap, then mint.json
  ├─ crawl: write each page to ~/.docmole/projects/<id>/pages/<path>.md
  │         with YAML frontmatter (source_url, fetched_at, title)
  │         inline content from llms-full.txt skips the per-page fetch
  ├─ index: walk pages/, tokenize, write BM25 to search-index.json
  └─ install skill: copy skills/docmole/SKILL.md to .claude/skills/docmole/
```

```
search(project, query)
  └─ load search-index.json → BM25 score (title boost 3×)
     → read top-K bodies in parallel, highlight snippets
     → emit markdown (default) or JSON (--raw)
```

## Key modules

| Path | Role |
|---|---|
| `src/cli/{setup,search,install,list}.ts` | Command entry points |
| `src/discovery/{llmsfull,sitemap,mintjson}.ts` | Page discovery adapters |
| `src/discovery/index.ts` | Auto-mode orchestration (llms-full first) |
| `src/crawler/{index,fetch,frontmatter}.ts` | Fetch + serialize markdown + frontmatter |
| `src/search/{bm25,index-build,query,page}.ts` | Pure-TS BM25 engine |
| `src/config/{schema,loader,paths}.ts` | YAML project config + data paths |
| `src/util/{http,fs,path,redact}.ts` | Small shared helpers |
| `scripts/build.ts` | `bun build → dist/cli.js` with Node shebang |
| `skills/docmole/SKILL.md` | The skill that ships + auto-installs |

## Data layout

```
~/.docmole/projects/<id>/
├── config.yaml           # source URL, indexed status, page count
├── pages/                # markdown mirror — URL path = file path
│   └── sessions/persisting.md
└── search-index.json     # BM25 inverted index
```

Each page opens with YAML frontmatter (`source_url`, `fetched_at`, `title`)
followed by the markdown body.

## Dev vs. ship

- **Dev runtime**: Bun (fast TS execution, built-in test runner).
- **Published runtime**: Node 18+ via `dist/cli.js`. `bun run build` bundles
  `src/index.ts` with `--target=node --packages external` and replaces Bun's
  auto-prepended shebang with `#!/usr/bin/env node`.
- The `bin` field in `package.json` points to `dist/cli.js`, NOT source TS.
- Published tarball contains `dist/`, `skills/`, `README.md`, `LICENSE` only.

## What NOT to add

- **No embedded LLM / embeddings / vector DB.** The whole point is
  retrieval-only. The consuming agent has its own model — a second one
  doubles tokens, adds API-key friction, and produces worse answers.
- **No MCP server.** See README for the CLI-vs-MCP tradeoff.
- **No backends system.** v1 had mintlify/embedded/agno pluggable backends;
  they were deleted during the v2 refactor. Don't reintroduce.
- **No auth until needed.** `config.yaml` has a stubbed `source.auth` field
  (`keyring:*` / `localEnv:*`) but no resolver yet. Wire it up when a user
  asks for a private-docs site, not before.

## Commit conventions

```
feat(scope):     new user-visible behavior
fix(scope):      bug fix
refactor(scope): behavior-preserving cleanup
chore(scope):    tooling, deps, infra
test(scope):     test-only changes
docs(scope):     docs-only changes
build(scope):    build pipeline changes
```

Small, focused commits. One logical change per commit. Never
`Co-Authored-By: Claude` or "Generated with Claude Code" lines.

## Pull request process

```bash
bun run lint && bun run typecheck && bun run test   # full gate
git checkout -b <type>/<slug>
# focused commits
gh pr create --base main --title "<type>: <summary>"
```
