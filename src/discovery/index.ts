import { normalizeBaseUrl } from "../util/http";
import { parseLlmsFull } from "./llmsfull";
import { parseMintJson } from "./mintjson";
import { type DiscoveredPage, filterByPrefix, parseSitemap } from "./sitemap";

export { extractTitle } from "./metadata";
export type { DiscoveredPage } from "./sitemap";

export type DiscoveryMethod = "llmsfull" | "sitemap" | "mintjson" | "auto";
export type ResolvedMethod = Exclude<DiscoveryMethod, "auto">;

export interface DiscoveryOptions {
  method?: DiscoveryMethod;
  prefix?: string;
  verbose?: boolean;
}

export interface DiscoveryResult {
  pages: DiscoveredPage[];
  method: ResolvedMethod;
  total: number;
  filtered: number;
}

// Auto-mode tries llms-full.txt first: one HTTP call returns the whole site
// as markdown, canonical quality (author-published, not HTML-extracted).
// Falls through to sitemap, then mint.json.
const AUTO_ORDER: { method: ResolvedMethod; parse: Parser }[] = [
  { method: "llmsfull", parse: parseLlmsFull },
  { method: "sitemap", parse: parseSitemap },
  { method: "mintjson", parse: parseMintJson },
];

type Parser = (baseUrl: string) => Promise<DiscoveredPage[]>;

export async function discoverPages(
  baseUrl: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const { method = "auto", prefix, verbose = false } = options;
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const plan =
    method === "auto"
      ? AUTO_ORDER
      : AUTO_ORDER.filter((step) => step.method === method);

  let pages: DiscoveredPage[] = [];
  let usedMethod: ResolvedMethod = plan[0]?.method ?? "sitemap";

  for (const step of plan) {
    if (verbose)
      console.error(`Trying ${step.method} from ${normalizedUrl}...`);
    pages = await step.parse(normalizedUrl);
    if (pages.length > 0) {
      usedMethod = step.method;
      if (verbose) {
        console.error(`Found ${pages.length} pages via ${step.method}`);
      }
      break;
    }
  }

  const totalPages = pages.length;

  if (prefix && pages.length > 0) {
    pages = filterByPrefix(pages, prefix);
    if (verbose) {
      console.error(
        `Filtered to ${pages.length} pages with prefix "${prefix}"`,
      );
    }
  }

  return {
    pages,
    method: usedMethod,
    total: totalPages,
    filtered: pages.length,
  };
}
