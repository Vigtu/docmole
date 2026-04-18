import { projectExists } from "../config/loader";
import {
  SearchIndexMissingError,
  SearchIndexVersionError,
  search,
} from "../search/query";
import type { SearchResult } from "../search/types";

export interface SearchOptions {
  project: string;
  query: string;
  limit?: number;
  raw?: boolean;
}

export async function searchCommand(options: SearchOptions): Promise<void> {
  const { project, query, limit = 5, raw = false } = options;

  if (!(await projectExists(project))) {
    console.error(`Error: project "${project}" not found.`);
    console.error("Run `docmole list` to see available projects.");
    process.exit(1);
  }

  let results: SearchResult[];
  try {
    results = await search(project, query, { limit });
  } catch (err) {
    if (
      err instanceof SearchIndexMissingError ||
      err instanceof SearchIndexVersionError
    ) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  if (raw) {
    process.stdout.write(JSON.stringify(results));
    return;
  }

  renderHumanReadable(query, results);
}

function renderHumanReadable(query: string, results: SearchResult[]): void {
  if (results.length === 0) {
    console.log(`No results for "${query}".`);
    console.log(
      "Tip: rewrite the query using domain keywords from the docs (nouns, not verbs).",
    );
    return;
  }

  console.log(`Found ${results.length} result(s) for "${query}":\n`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`${i + 1}. ${r.path} — ${r.title} (score ${r.score})`);
    console.log(`   abs: ${r.abs}`);
    if (r.snippet) console.log(`   ${r.snippet}`);
    console.log();
  }

  if (results.length >= 2) {
    const heads = results
      .slice(0, 2)
      .map((r) => r.abs)
      .join(" ");
    console.log(`Next: head -80 ${heads}`);
  }
}
