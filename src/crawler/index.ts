import { paths } from "../config/paths";
import type { DiscoveredPage } from "../discovery";
import { writeWithParents } from "../util/fs";
import { UnsafeUrlPathError, urlPathToFilePath } from "../util/path";
import { redactUrl } from "../util/redact";
import { fetchPage } from "./fetch";
import { type PageFrontmatter, serializePage } from "./frontmatter";

const DEFAULT_CONCURRENCY = 5;

export interface CrawlResult {
  fetched: number;
  failed: number;
  skipped: number;
}

export interface CrawlOptions {
  concurrency?: number;
  verbose?: boolean;
}

export async function crawlPages(
  projectId: string,
  pages: DiscoveredPage[],
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const verbose = options.verbose ?? false;
  const result: CrawlResult = { fetched: 0, failed: 0, skipped: 0 };

  let cursor = 0;
  const next = () => (cursor < pages.length ? pages[cursor++] : undefined);

  const workers = Array.from(
    { length: Math.min(concurrency, pages.length) },
    () => worker(projectId, next, result, verbose),
  );
  await Promise.all(workers);

  return result;
}

async function worker(
  projectId: string,
  next: () => DiscoveredPage | undefined,
  result: CrawlResult,
  verbose: boolean,
): Promise<void> {
  for (let page = next(); page; page = next()) {
    await handleOne(projectId, page, result, verbose);
  }
}

async function handleOne(
  projectId: string,
  page: DiscoveredPage,
  result: CrawlResult,
  verbose: boolean,
): Promise<void> {
  let relPath: string;
  try {
    relPath = urlPathToFilePath(page.path);
  } catch (err) {
    if (err instanceof UnsafeUrlPathError) {
      result.skipped++;
      if (verbose) console.error(`skip (unsafe path): ${page.path}`);
      return;
    }
    throw err;
  }

  const fetched = await fetchPage(page.url, page.path);
  if (!fetched) {
    result.failed++;
    if (verbose) console.error(`fail: ${redactUrl(page.url)}`);
    return;
  }

  const frontmatter: PageFrontmatter = {
    source_url: page.url,
    fetched_at: new Date().toISOString(),
    title: fetched.title,
  };

  await writeWithParents(
    paths.projectPage(projectId, relPath),
    serializePage(frontmatter, fetched.markdown),
  );

  result.fetched++;
  if (verbose) console.error(`ok (${fetched.source}): ${relPath}`);
}
