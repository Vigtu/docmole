import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { extractTitle } from "../discovery/metadata";
import { USER_AGENT } from "../util/http";

const FETCH_TIMEOUT_MS = 30_000;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export interface FetchedPage {
  markdown: string;
  title: string;
  source: "markdown-fastpath" | "html-readability";
}

export async function fetchPage(
  pageUrl: string,
  urlPath: string,
): Promise<FetchedPage | null> {
  const fastpath = await tryMarkdownFastpath(pageUrl, urlPath);
  if (fastpath) return fastpath;
  return tryHtmlFallback(pageUrl, urlPath);
}

async function tryMarkdownFastpath(
  pageUrl: string,
  urlPath: string,
): Promise<FetchedPage | null> {
  const normalized = pageUrl.replace(/\/$/, "");
  const mdUrl = normalized.endsWith(".md") ? normalized : `${normalized}.md`;

  const response = await safeFetch(mdUrl, {
    Accept: "text/markdown, text/plain",
  });
  if (!response || !response.ok) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("html")) return null;

  const body = await response.text();
  if (!body.trim() || body.trimStart().startsWith("<")) return null;

  return {
    markdown: body,
    title: extractTitle(body, urlPath),
    source: "markdown-fastpath",
  };
}

async function tryHtmlFallback(
  pageUrl: string,
  urlPath: string,
): Promise<FetchedPage | null> {
  const response = await safeFetch(pageUrl, { Accept: "text/html" });
  if (!response || !response.ok) return null;

  const html = await response.text();
  const dom = new JSDOM(html, { url: pageUrl });
  const article = new Readability(dom.window.document).parse();
  if (!article || !article.content) return null;

  const markdown = turndown.turndown(article.content);
  if (!markdown.trim()) return null;

  const title = article.title?.trim() || extractTitle(markdown, urlPath);
  return { markdown, title, source: "html-readability" };
}

async function safeFetch(
  url: string,
  accept: Record<string, string>,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, ...accept },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
