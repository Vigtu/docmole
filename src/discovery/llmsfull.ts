// llms-full.txt is a proposed convention (https://llmstxt.org) for docs sites
// to publish their entire content as a single markdown file, one page per
// block. Observed in Fumadocs, Mintlify, Anthropic and OpenAI docs.
//
// Each block begins with:
//   # <Title>
//   URL: /<path>
//   [Source: <upstream url>]   (optional; may repeat)
//   <blank line>
//   <markdown body>
//
// Pages are delimited by a top-level `# ` heading followed on the next line
// by `URL: `. Body can freely use `##` and deeper headings without ambiguity.

import { FETCH_TIMEOUT_MS, normalizeBaseUrl, USER_AGENT } from "../util/http";
import type { DiscoveredPage } from "./sitemap";

const MAX_BYTES = 10 * 1024 * 1024;

// Split on a line that looks like a page header: `# <title>` followed by a
// `URL: ` line. The lookahead keeps the `# ` at the top of each resulting
// block (plain split would consume it).
const PAGE_SPLIT = /\n(?=# [^\n]+\nURL: )/;

export async function parseLlmsFull(
  baseUrl: string,
): Promise<DiscoveredPage[]> {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const fileUrl = `${normalizedBase}/llms-full.txt`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(fileUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/plain, */*" },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) return [];

    const text = await response.text();
    if (text.length > MAX_BYTES) return [];

    return parseLlmsFullContent(text, normalizedBase);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function parseLlmsFullContent(
  text: string,
  baseUrl: string,
): DiscoveredPage[] {
  const pages: DiscoveredPage[] = [];
  // Prepend a newline so PAGE_SPLIT matches the first block uniformly (its
  // lookahead needs a preceding `\n` to fire).
  const blocks = `\n${text.trimStart()}`.split(PAGE_SPLIT);

  for (const block of blocks) {
    const parsed = parseBlock(block, baseUrl);
    if (parsed) pages.push(parsed);
  }
  return pages;
}

function parseBlock(block: string, baseUrl: string): DiscoveredPage | null {
  if (!block.startsWith("# ")) return null;
  const lines = block.split("\n");

  const title = lines[0].slice(2).trim();
  let path: string | undefined;
  let bodyStart = lines.length;

  // Walk header lines until a blank separates them from the body. Unknown
  // header keys (e.g. `Source:`) are skipped rather than terminating, since
  // the spec allows arbitrary metadata before the blank line.
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "") {
      bodyStart = i + 1;
      break;
    }
    if (lines[i].startsWith("URL:")) {
      path = lines[i].slice(4).trim();
    }
  }

  if (!path) return null;

  const body = lines.slice(bodyStart).join("\n").trim();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return {
    url: `${baseUrl}${normalizedPath}`,
    path: normalizedPath,
    title,
    content: body,
  };
}
