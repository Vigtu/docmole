# Contributing to docmole

## Quick start

```bash
git clone https://github.com/Vigtu/docmole.git && cd docmole
bun install

bun run test         # run all tests
bun run typecheck    # tsc --noEmit
bun run lint         # biome check --write
bun run build        # bundle dist/cli.js for Node
```

**Requirements for hacking on the repo:** [Bun](https://bun.sh) ≥ 1.0. End
users of the published npm package only need Node 18+ — the tarball ships a
pre-built `dist/cli.js`.

## Architecture at a glance

See [AGENT.md](./AGENT.md) for the full layer diagram + data flow. The short
version:

- **`src/cli/*`** — command entry points (setup, search, install, list)
- **`src/discovery/*`** — adapters for llms-full.txt, sitemap.xml, mint.json
- **`src/crawler/*`** — fetch + markdown extraction + frontmatter serialization
- **`src/search/*`** — pure-TS BM25 scorer + index builder + query engine
- **`src/util/*`** — shared helpers (http, fs, path safety, URL redaction)
- **`skills/docmole/SKILL.md`** — the skill that ships + auto-installs

No backends, no MCP server, no embeddings. docmole is a retrieval-only CLI;
the consuming agent (Claude Code, Cursor) handles synthesis.

## Adding a discovery method

New formats (e.g. `readme.md` directory listings, RSS feeds, sitemap
indexes) are the most likely additions. Pattern:

1. Create `src/discovery/<name>.ts` exporting
   `async function parse<Name>(baseUrl: string): Promise<DiscoveredPage[]>`.
   Return `[]` on any failure — never throw.
2. For inline-content formats (like llms-full.txt), populate
   `DiscoveredPage.content` so the crawler skips the fetch.
3. Register in `src/discovery/index.ts::AUTO_ORDER`. Cheaper / higher-fidelity
   methods go first.
4. Add `"<name>"` to the `discovery` union in `src/config/schema.ts`.
5. Tests in `tests/<name>.test.ts`.

## Testing guidelines

**Layout**

```
tests/
├── crawler.test.ts     # src/crawler/* + src/util/path.ts
├── install.test.ts     # src/cli/install.ts + CLI integration
├── llmsfull.test.ts    # src/discovery/llmsfull.ts parser
└── search.test.ts      # src/search/*
```

One test file per major module. Don't create a new file just for one test.

**What's worth testing**

- Business logic that can fail on wrong input (BM25 scoring, path safety,
  frontmatter parsing, llms-full block extraction)
- Real-system integration (does `setup` really write files? does `search`
  really rank?)
- Error paths (unsafe URL → skipped, missing index → clear error message)

**What's NOT worth testing**

- Hardcoded defaults (`expect(K1).toBe(1.2)` — changing it isn't a bug)
- Library behavior (`Array.isArray(...)` — that's ripgrep's job, not ours)
- Shape assertions that pass on every type of garbage input

## Code style

- **Formatter**: [Biome](https://biomejs.dev) (double quotes, semicolons, auto-import sort)
- **TypeScript**: strict mode
- **Comments**: explain WHY, not WHAT. Delete the comment if removing it
  wouldn't confuse a future reader.
- **No backwards-compat shims** unless the breaking change is already
  shipped on npm. Before that, just edit the code.

Run `bun run lint` before pushing — it auto-fixes most issues.

## Commit conventions

```
feat(scope):     new user-visible behavior
fix(scope):      bug fix
refactor(scope): behavior-preserving cleanup
chore(scope):   tooling, deps, infra
test(scope):    test-only changes
docs(scope):    docs-only changes
build(scope):   build pipeline changes
```

Small, focused commits. One logical change per commit. Do NOT add
`Co-Authored-By: Claude` or "Generated with Claude Code" lines.

## Pull request process

```bash
# 1. Branch
git checkout -b <type>/<slug>

# 2. Full gate before pushing
bun run lint && bun run typecheck && bun run test && bun run build

# 3. Push + open PR
git push -u origin HEAD
gh pr create --base main --title "<type>: <summary>"
```

Open an issue first for changes that touch the architecture (new discovery
method, index format bump, skill protocol change). Small fixes can go
straight to PR.

## License

By contributing, you agree that your contributions are licensed under the
MIT License (see [LICENSE](./LICENSE)).
