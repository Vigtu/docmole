import { paths } from "../config/paths";
import { scoreBM25, tokenize } from "./bm25";
import { parsePage } from "./page";
import type { SearchIndex, SearchResult } from "./types";
import { INDEX_VERSION } from "./types";

const SNIPPET_WINDOW = 240;

export class SearchIndexMissingError extends Error {
  constructor(projectId: string) {
    super(
      `no search index for project "${projectId}". Run \`docmole setup\` to build one.`,
    );
    this.name = "SearchIndexMissingError";
  }
}

export class SearchIndexVersionError extends Error {
  constructor(found: number) {
    super(
      `search index version ${found} is not supported by this build (expected ${INDEX_VERSION}). Re-run \`docmole setup\`.`,
    );
    this.name = "SearchIndexVersionError";
  }
}

export async function loadSearchIndex(projectId: string): Promise<SearchIndex> {
  let index: SearchIndex;
  try {
    index = (await Bun.file(
      paths.projectSearchIndex(projectId),
    ).json()) as SearchIndex;
  } catch {
    throw new SearchIndexMissingError(projectId);
  }
  if (index.version !== INDEX_VERSION) {
    throw new SearchIndexVersionError(index.version);
  }
  return index;
}

export interface QueryOptions {
  limit?: number;
}

export async function search(
  projectId: string,
  query: string,
  options: QueryOptions = {},
): Promise<SearchResult[]> {
  const limit = options.limit ?? 5;
  const index = await loadSearchIndex(projectId);
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || index.docs.length === 0) return [];

  const tokenFreq = new Map<string, number>();
  for (const t of queryTokens) tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1);

  const scores = new Map<number, number>();
  for (const [token, freq] of tokenFreq) {
    const postings = index.postings[token];
    if (!postings) continue;
    const tokenScores = scoreBM25(postings, freq, index.docs, index.avg_length);
    for (const [doc, score] of tokenScores) {
      scores.set(doc, (scores.get(doc) ?? 0) + score);
    }
  }

  const ranked = Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  const pattern = highlightPattern(tokenFreq.keys());
  return Promise.all(
    ranked.map(async ([docIdx, score]) => {
      const doc = index.docs[docIdx];
      const abs = paths.projectPage(projectId, doc.path);
      const snippet = await buildSnippet(abs, tokenFreq, pattern);
      return {
        path: doc.path,
        abs,
        title: doc.title,
        score: Math.round(score * 1000) / 1000,
        snippet,
      };
    }),
  );
}

async function buildSnippet(
  absPath: string,
  tokens: Map<string, number>,
  pattern: RegExp | null,
): Promise<string> {
  const content = await Bun.file(absPath).text();
  const parsed = parsePage(content);
  const body = parsed ? parsed.body : content;
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return "";

  const lower = compact.toLowerCase();
  let hit = -1;
  for (const token of tokens.keys()) {
    const idx = lower.indexOf(token);
    if (idx !== -1 && (hit === -1 || idx < hit)) hit = idx;
  }

  const start =
    hit === -1 ? 0 : Math.max(0, hit - Math.floor(SNIPPET_WINDOW / 3));
  const end = Math.min(compact.length, start + SNIPPET_WINDOW);
  const raw = compact.slice(start, end);
  const prefix = start > 0 ? "… " : "";
  const suffix = end < compact.length ? " …" : "";
  const highlighted = pattern ? raw.replace(pattern, "<mark>$1</mark>") : raw;
  return prefix + highlighted + suffix;
}

function highlightPattern(tokens: Iterable<string>): RegExp | null {
  const list = Array.from(tokens, escapeRegex);
  if (list.length === 0) return null;
  return new RegExp(`(${list.join("|")})`, "gi");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
