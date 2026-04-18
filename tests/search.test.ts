import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scoreBM25, tokenize } from "../src/search/bm25";
import { buildSearchIndex } from "../src/search/index-build";
import { parsePage } from "../src/search/page";
import { search } from "../src/search/query";

const PROJECT_ID = "search-test";
let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "docmole-search-"));
  process.env.DOCMOLE_DATA_DIR = tmpRoot;

  const pages = join(tmpRoot, "projects", PROJECT_ID, "pages");
  await Bun.write(
    join(pages, "sessions", "persisting.md"),
    frontmatter("Persisting Sessions", "https://ex.com/sessions/persisting") +
      "Configure a database to persist agent session storage across runs. " +
      "Sessions survive restarts when persistence is enabled.",
  );
  await Bun.write(
    join(pages, "memory", "overview.md"),
    frontmatter("Agent Memory", "https://ex.com/memory/overview") +
      "Memory lets agents recall prior conversations. Different from session storage persistence.",
  );
  await Bun.write(
    join(pages, "index.md"),
    `${frontmatter("Home", "https://ex.com/")}Welcome. Unrelated content.`,
  );

  await buildSearchIndex(PROJECT_ID);
});

afterAll(async () => {
  await Bun.file(tmpRoot).exists(); // keep bun happy; tmp dir cleanup is OS-handled
});

function frontmatter(title: string, url: string): string {
  return `---\nsource_url: ${url}\nfetched_at: 2026-04-17T00:00:00.000Z\ntitle: ${title}\n---\n\n`;
}

describe("tokenize", () => {
  test("lowercases and splits on non-alphanum", () => {
    expect(tokenize("Persist-Agent Session_storage!")).toEqual([
      "persist",
      "agent",
      "session",
      "storage",
    ]);
  });

  test("drops tokens shorter than 3 chars", () => {
    expect(tokenize("a an the data to db")).toEqual(["the", "data"]);
  });

  test("empty input gives empty list", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("  !! ,, ??")).toEqual([]);
  });
});

describe("BM25 scorer", () => {
  test("idf rewards rare tokens", () => {
    const docs = [
      { length: 10 },
      { length: 10 },
      { length: 10 },
      { length: 10 },
    ];
    const avg = 10;

    const rareScores = scoreBM25([{ doc: 0, tf: 1 }], 1, docs, avg);
    const commonScores = scoreBM25(
      [
        { doc: 0, tf: 1 },
        { doc: 1, tf: 1 },
        { doc: 2, tf: 1 },
        { doc: 3, tf: 1 },
      ],
      1,
      docs,
      avg,
    );
    expect(rareScores.get(0)).toBeGreaterThan(commonScores.get(0) ?? 0);
  });

  test("length normalization penalizes long docs with same tf", () => {
    const docs = [{ length: 5 }, { length: 50 }];
    const avg = 27.5;
    const scores = scoreBM25(
      [
        { doc: 0, tf: 2 },
        { doc: 1, tf: 2 },
      ],
      1,
      docs,
      avg,
    );
    expect(scores.get(0)).toBeGreaterThan(scores.get(1) ?? 0);
  });
});

describe("parsePage", () => {
  test("extracts frontmatter and body", () => {
    const parsed = parsePage(`${frontmatter("T", "https://x")}body text`);
    expect(parsed?.frontmatter.title).toBe("T");
    expect(parsed?.body).toBe("body text");
  });

  test("returns null when frontmatter missing", () => {
    expect(parsePage("no frontmatter here")).toBeNull();
  });

  test("returns null when frontmatter lacks required fields", () => {
    expect(parsePage("---\nfoo: bar\n---\n\nbody")).toBeNull();
  });
});

describe("search", () => {
  test("ranks the exact-match page above unrelated pages", async () => {
    const results = await search(PROJECT_ID, "persist session storage");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe("sessions/persisting.md");
  });

  test("result carries abs path that exists", async () => {
    const results = await search(PROJECT_ID, "memory");
    expect(results.length).toBeGreaterThan(0);
    expect(await Bun.file(results[0].abs).exists()).toBe(true);
  });

  test("snippet highlights query tokens with <mark>", async () => {
    const results = await search(PROJECT_ID, "persist");
    expect(results[0].snippet).toContain("<mark>persist");
  });

  test("unknown query returns empty array", async () => {
    const results = await search(PROJECT_ID, "zzzznothingmatches");
    expect(results).toEqual([]);
  });

  test("limit caps result count", async () => {
    const results = await search(PROJECT_ID, "session memory storage", {
      limit: 1,
    });
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
