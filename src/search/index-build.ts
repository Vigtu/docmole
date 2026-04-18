import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { paths } from "../config/paths";
import { tokenize } from "./bm25";
import { parsePage } from "./page";
import { INDEX_VERSION, type IndexedDoc, type SearchIndex } from "./types";

const TITLE_BOOST = 3;

export async function buildSearchIndex(
  projectId: string,
): Promise<SearchIndex> {
  const root = paths.projectPages(projectId);
  const files = await walkMarkdown(root);

  const docs: IndexedDoc[] = [];
  const postings: Record<string, Map<number, number>> = {};
  let totalLength = 0;

  for (const absFile of files) {
    const content = await Bun.file(absFile).text();
    const parsed = parsePage(content);
    if (!parsed) continue;

    const relPath = toPosix(relative(root, absFile));
    const titleTokens = tokenize(parsed.frontmatter.title);
    const bodyTokens = tokenize(parsed.body);
    const docLength = titleTokens.length * TITLE_BOOST + bodyTokens.length;

    const docIdx = docs.length;
    docs.push({
      path: relPath,
      title: parsed.frontmatter.title,
      length: docLength,
    });
    totalLength += docLength;

    const addToken = (token: string, weight: number) => {
      let bucket = postings[token];
      if (!bucket) {
        bucket = new Map();
        postings[token] = bucket;
      }
      bucket.set(docIdx, (bucket.get(docIdx) ?? 0) + weight);
    };
    for (const token of titleTokens) addToken(token, TITLE_BOOST);
    for (const token of bodyTokens) addToken(token, 1);
  }

  const avgLength = docs.length > 0 ? totalLength / docs.length : 0;
  const serialized: SearchIndex = {
    version: INDEX_VERSION,
    built_at: new Date().toISOString(),
    docs,
    postings: Object.fromEntries(
      Object.entries(postings).map(([token, docMap]) => [
        token,
        Array.from(docMap, ([doc, tf]) => ({ doc, tf })),
      ]),
    ),
    avg_length: avgLength,
  };

  await Bun.write(
    paths.projectSearchIndex(projectId),
    JSON.stringify(serialized),
  );
  return serialized;
}

async function walkMarkdown(root: string): Promise<string[]> {
  const names = await readdir(root, { recursive: true });
  return names.filter((n) => n.endsWith(".md")).map((n) => join(root, n));
}

function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}
