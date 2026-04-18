---
name: docmole
description: Query a local mirror of any documentation site. Use when the user asks a question about a library, framework, or API that has been indexed with `docmole setup`.
allowed-tools: Bash(docmole:*) Bash(head:*) Bash(cat:*) Bash(rg:*)
---

# Querying documentation with docmole

`docmole` keeps a local markdown mirror of any documentation site under `~/.docmole/projects/<id>/pages/`. It gives you two primitives — BM25 search and the filesystem — and expects **you** to synthesize the answer.

## Quick start

```bash
# 1. Rewrite the user's question as domain keywords (nouns, not verbs).
# 2. Search the project for those keywords.
docmole search --project <id> "<keywords>"

# 3. Read the top 2 results (head, not cat — prefix first).
head -80 <abs-path-1> <abs-path-2>

# 4. Only cat the whole file if head didn't answer the question.
cat <abs-path>
```

## The pattern (read this before searching)

### Step 1 — Rewrite before searching

BM25 is a keyword engine, not a semantic one. A vague user question won't match. Rewrite it into the vocabulary the docs actually use.

| User asked | Don't search this | Search this |
|---|---|---|
| "how do I keep agent data between runs" | `keep data between runs` | `persist agent session storage database` |
| "my requests are slow, what do I do" | `requests slow` | `rate limit timeout retry backoff` |
| "can agents talk to each other" | `agents talk` | `team coordination handoff multi-agent` |

Look at the user's question, identify the domain nouns it's *about*, then add synonyms the docs probably use.

### Step 2 — Batch head, don't cat

`docmole search` returns 5 results by default. **You read the top 2-3 with `head -80` in a single tool call**, not the full files. `head` accepts multiple files in one invocation:

```bash
head -80 /home/you/.docmole/projects/agno/pages/sessions/persisting-sessions/overview.md /home/you/.docmole/projects/agno/pages/database/session-storage.md
```

The result's `abs` field is the absolute path — paste it directly into `head`.

### Step 3 — Only cat if head didn't answer

If the first 80 lines answered the question, stop. Write the answer citing the source. Only `cat <abs>` if the prefix was insufficient.

## Output contract

`docmole search --raw` returns a JSON array to stdout, one entry per result:

```json
[
  {
    "path": "sessions/persisting-sessions/overview.md",
    "abs": "/home/you/.docmole/projects/agno/pages/sessions/persisting-sessions/overview.md",
    "title": "Persisting Sessions",
    "score": 12.431,
    "snippet": "… configure a <mark>database</mark> to <mark>persist</mark> the <mark>session</mark> …"
  }
]
```

Without `--raw`, output is human-readable with a `Next: head -80 ...` hint. Prefer `--raw` when piping into other tools.

## Commands

```bash
# Full search
docmole search --project agno "persist session storage"

# Raw JSON for pipes
docmole search --project agno --raw "persist session storage" | jq '.[0].abs'

# Limit results
docmole search --project agno --limit 3 "memory knowledge vector"

# List indexed projects
docmole list
```

## Example: answering a vague question end-to-end

```bash
# User: "how do I keep agent data between runs in agno?"

# Step 1: rewrite → "persist agent session storage database"
# Step 2: search
docmole search --project agno "persist agent session storage database"
# → top 2 results with abs paths

# Step 3: batch head (single tool call)
head -80 ~/.docmole/projects/agno/pages/sessions/persisting-sessions/overview.md \
        ~/.docmole/projects/agno/pages/database/session-storage.md

# Step 4: answer the user, citing source_url from each file's frontmatter.
```

## What not to do

- **Don't cat files first.** `head -80` usually answers. Only cat on failure.
- **Don't pass the user's raw question as the query.** Rewrite into domain keywords.
- **Don't read 5 results.** Read 2, maybe 3. Stop when you have the answer.
- **Don't invent content.** If `head` shows the topic isn't covered, say so — don't backfill from training data.

## Where things live

| Path | Contents |
|---|---|
| `~/.docmole/projects/<id>/config.yaml` | Project metadata (source URL, status) |
| `~/.docmole/projects/<id>/pages/` | Markdown mirror with YAML frontmatter per page |
| `~/.docmole/projects/<id>/search-index.json` | BM25 index (rebuilt by `docmole setup`) |

Each page begins with frontmatter:

```yaml
---
source_url: https://docs.agno.com/sessions/persisting-sessions/overview
fetched_at: 2026-04-17T22:30:00.000Z
title: Persisting Sessions
---
```

Cite `source_url` when linking the user back to the canonical doc.
