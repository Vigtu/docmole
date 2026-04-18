<p align="center">
  <a href="https://github.com/Vigtu/docmole">
    <img loading="lazy" alt="docmole" src="https://raw.githubusercontent.com/Vigtu/docmole/main/assets/docmole-hero.svg" width="100%"/>
  </a>
</p>

# docmole

<p align="center">
  <em>Local markdown mirror + BM25 search for any docs site. Built for CLI agents.</em>
</p>

[![npm version](https://img.shields.io/npm/v/docmole?cacheSeconds=3600)](https://www.npmjs.com/package/docmole)
[![License](https://img.shields.io/badge/license-MIT-green)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)](https://nodejs.org)

docmole mirrors any documentation site to local markdown, builds a BM25 search index, and ships a skill package so CLI agents (Claude Code, Cursor) discover and use it automatically. **No embedded LLM. No embeddings. No API keys.** The consuming agent does all semantic work.

## docmole vs MCP servers

If you're building for **coding agents**, CLI + skills is the better fit:

- **CLI + skills** — token-efficient. Agents invoke concise commands and read files via native `head`/`cat`. No giant tool schemas in context, no verbose accessibility trees. Same pattern as [`@playwright/cli`](https://github.com/microsoft/playwright-cli).
- **MCP** — good for stateful, long-running loops (self-healing tests, persistent browser context). Overhead not worth it for docs retrieval.

## Install

```bash
npm install -g docmole
docmole --help
```

Requires Node 18+. No Bun on your machine — the package ships a pre-built Node bundle.

## Quick start

```bash
# 1. Mirror + index a docs site (also auto-installs the skill)
docmole setup --url https://docs.agno.com --id agno

# 2. Restart Claude Code if it was already open in this dir
claude

# 3. Ask in natural language
> how do I persist agent session storage in agno?
```

The agent:
1. Reads `.claude/skills/docmole/SKILL.md`
2. Rewrites your question into domain keywords
3. Runs `docmole search --project agno "<keywords>"`
4. Batches `head -80` across the top 2 results in one tool call
5. Answers, citing `source_url` from each page's frontmatter

## Commands

```bash
docmole setup    --url <url> --id <id> [--prefix <path>] [--skip-crawl] [--verbose]
docmole search   --project <id> "<query>" [--limit <n>] [--raw]
docmole install  --skills [--force] [--target <dir>]
docmole list
```

### setup
Discovers pages from `sitemap.xml` or `mint.json`, crawls markdown (prefers Mintlify's `.md` fastpath, falls back to HTML → Readability → Turndown), writes to `~/.docmole/projects/<id>/pages/<path>.md` with YAML frontmatter, builds a BM25 index, and auto-installs the skill into `<cwd>/.claude/skills/docmole/`.

### search
BM25 keyword search with title boost (3×). Default output is human-readable markdown with `<mark>` highlights:

```
1. sessions/persisting.md — Persisting Sessions (score 4.812)
   abs: /home/you/.docmole/projects/agno/pages/sessions/persisting.md
   … configure a <mark>database</mark> to <mark>persist</mark> the <mark>session</mark> …

Next: head -80 /home/.../persisting.md /home/.../session-storage.md
```

Pass `--raw` for pure JSON designed to pipe into `jq`:

```bash
docmole search --project agno --raw "persist session" | jq '.[0].abs'
```

Each result carries `{path, abs, title, score, snippet}`. Agents paste `abs` directly into `head -80`.

### install --skills
Copies the docmole skill into `.claude/skills/docmole/`. `setup` does this automatically; run `install` explicitly to:

```bash
docmole install --skills --force              # overwrite a customized skill
docmole install --skills --target ~           # install globally (applies to every project)
```

### list
Shows every project with its source URL (redacted), index status, and page count.

## Data layout

```
~/.docmole/
└── projects/<id>/
    ├── config.yaml          # source url, indexed status, page count
    ├── pages/               # markdown mirror — URL path = file path
    │   └── sessions/persisting-sessions/overview.md
    └── search-index.json    # BM25 inverted index (rebuilt by setup)
```

Each `.md` page opens with:

```yaml
---
source_url: https://docs.agno.com/sessions/persisting-sessions/overview
fetched_at: 2026-04-17T22:30:00.000Z
title: Persisting Sessions
---
```

## The skill pattern

docmole's SKILL.md teaches the agent a 3-step discipline:

| Step | Why it matters |
|---|---|
| **Rewrite the user's question into keywords** | BM25 is lexical. `"how do I keep data between runs"` → `"persist session storage database"`. |
| **Batch `head -80` across the top 2 results in one tool call** | Reads are ~40× cheaper than `cat`; parallel batch beats sequential. |
| **Only `cat` if `head` didn't answer** | Don't inflate context with whole files when the prefix usually suffices. |

The SKILL.md frontmatter pre-authorizes `Bash(docmole:*) Bash(head:*) Bash(cat:*) Bash(rg:*)` so Claude Code doesn't prompt for permission on the hot path.

## Team sharing (today + planned)

Team members already get identical results via `rsync` / `git` / S3 sync of a `projects/<id>/` directory. Source URLs and crawl creds never leave the machine that crawled — only the `pages/` output travels.

Later: `docmole publish` / `docmole pull` for bundles, and a central daemon with RBAC for enterprise. Not built yet.

## Contributing

```bash
git clone https://github.com/Vigtu/docmole.git && cd docmole
bun install          # uses Bun for dev speed (Node for publish)
bun run test         # runs test suite
bun run typecheck    # tsc --noEmit
bun run lint         # biome check --write
bun run build        # builds dist/cli.js (Node target)
```

Runtime is Node 18+ via `dist/cli.js`. Development uses Bun for fast TS execution and the built-in test runner. The build step decouples the two.

## Acknowledgments

- [`@playwright/cli`](https://github.com/microsoft/playwright-cli) — CLI + skills pattern inspiration
- [Mintlify](https://mintlify.com) — observed their `docs as filesystem + bash tool` pivot on `docs.agno.com`; the skill pattern is reverse-engineered from their actual agent behavior

## License

MIT — see [LICENSE](./LICENSE).
