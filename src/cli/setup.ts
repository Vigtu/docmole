import { projectExists, saveProjectConfig } from "../config/loader";
import { paths } from "../config/paths";
import {
  createDefaultProjectConfig,
  type IndexStatus,
  isValidProjectId,
  type ProjectConfig,
} from "../config/schema";
import { crawlPages } from "../crawler";
import { discoverPages } from "../discovery";
import { redactUrl } from "../util/redact";

export interface SetupOptions {
  url: string;
  id: string;
  name?: string;
  prefix?: string;
  auth?: string;
  skipCrawl?: boolean;
  verbose?: boolean;
}

export async function setupCommand(options: SetupOptions): Promise<void> {
  const {
    url,
    id,
    name,
    prefix,
    auth,
    skipCrawl = false,
    verbose = false,
  } = options;

  console.log("\nSetting up documentation project...\n");

  if (!isValidProjectId(id)) {
    console.error(
      "Error: project id must contain only lowercase letters, numbers, and hyphens.",
    );
    process.exit(1);
  }

  if (await projectExists(id)) {
    console.error(`Error: project "${id}" already exists.`);
    process.exit(1);
  }

  if (auth) {
    console.error("Error: --auth is not yet supported; use a public URL.");
    process.exit(1);
  }

  const parsedUrl = parseUrl(url);
  const normalizedUrl = normalizeUrl(parsedUrl);

  console.log(`Discovering pages from ${redactUrl(normalizedUrl)}...`);

  const discovery = await discoverPages(normalizedUrl, {
    prefix,
    method: "auto",
    verbose,
  });

  if (discovery.pages.length === 0) {
    console.error("Error: no pages found.");
    process.exit(1);
  }

  console.log(`Found ${discovery.pages.length} pages via ${discovery.method}`);

  const config = createDefaultProjectConfig(id, normalizedUrl, {
    name: name || siteNameFromHostname(parsedUrl.hostname),
    prefix,
    discovery: discovery.method,
  });

  if (skipCrawl) {
    await saveProjectConfig(config);
    console.log(`Config saved to: ${paths.projectConfig(id)}`);
    console.log("Skipping crawl (--skip-crawl). Run setup again to fetch.");
    return;
  }

  console.log(
    `Crawling ${discovery.pages.length} pages into ${paths.projectPages(id)}...`,
  );

  const result = await crawlPages(id, discovery.pages, { verbose });
  console.log(
    `Done. fetched=${result.fetched} failed=${result.failed} skipped=${result.skipped}`,
  );

  const finalStatus: IndexStatus["status"] =
    result.fetched > 0 ? "completed" : "failed";
  recordIndexed(config, finalStatus, result.fetched);
  await saveProjectConfig(config);
  console.log(`Config saved to: ${paths.projectConfig(id)}`);

  if (finalStatus === "failed") {
    console.error("Error: no pages were fetched successfully.");
    process.exit(1);
  }
}

function recordIndexed(
  config: ProjectConfig,
  status: IndexStatus["status"],
  pagesCount: number,
): void {
  config.indexed = {
    status,
    at: new Date().toISOString(),
    pages_count: pagesCount,
  };
}

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    console.error(`Error: invalid URL: ${url}`);
    process.exit(1);
  }
}

function normalizeUrl(parsed: URL): string {
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(
    /\/$/,
    "",
  );
}

function siteNameFromHostname(hostname: string): string {
  const name = hostname
    .replace(/^(docs|www)\./, "")
    .replace(/\.(com|io|dev|ai|org|net)$/, "")
    .replace(/\./g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return `${name} Docs`;
}
