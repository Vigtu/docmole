import { describe, expect, test } from "bun:test";
import {
  type PageFrontmatter,
  serializePage,
} from "../src/crawler/frontmatter";
import { UnsafeUrlPathError, urlPathToFilePath } from "../src/util/path";

describe("urlPathToFilePath", () => {
  test("root maps to index.md", () => {
    expect(urlPathToFilePath("/")).toBe("index.md");
    expect(urlPathToFilePath("")).toBe("index.md");
  });

  test("leaf without trailing slash gets .md suffix", () => {
    expect(urlPathToFilePath("/foo")).toBe("foo.md");
    expect(urlPathToFilePath("/foo/bar")).toBe("foo/bar.md");
  });

  test("trailing slash becomes index.md in that dir", () => {
    expect(urlPathToFilePath("/foo/")).toBe("foo/index.md");
    expect(urlPathToFilePath("/foo/bar/")).toBe("foo/bar/index.md");
  });

  test("already .md leaf is not double-suffixed", () => {
    expect(urlPathToFilePath("/foo/bar.md")).toBe("foo/bar.md");
  });

  test("parent-dir traversal is rejected", () => {
    expect(() => urlPathToFilePath("/../etc/passwd")).toThrow(
      UnsafeUrlPathError,
    );
    expect(() => urlPathToFilePath("/foo/../bar")).toThrow(UnsafeUrlPathError);
    expect(() => urlPathToFilePath("/..")).toThrow(UnsafeUrlPathError);
  });

  test("percent-encoded traversal is rejected after decode", () => {
    expect(() => urlPathToFilePath("/%2e%2e/etc/passwd")).toThrow(
      UnsafeUrlPathError,
    );
  });

  test("control chars and null bytes are rejected", () => {
    expect(() => urlPathToFilePath("/foo%00bar")).toThrow(UnsafeUrlPathError);
  });

  test("excessive depth is rejected", () => {
    const deep = `/${"a/".repeat(20)}leaf`;
    expect(() => urlPathToFilePath(deep)).toThrow(UnsafeUrlPathError);
  });
});

describe("serializePage", () => {
  const frontmatter: PageFrontmatter = {
    source_url: "https://docs.agno.com/memory/agent/overview",
    fetched_at: "2026-04-17T22:30:00.000Z",
    title: "Agent Memory",
  };

  test("emits YAML frontmatter block before body", () => {
    const out = serializePage(frontmatter, "# Agent Memory\n\nBody text.");
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain(
      "source_url: https://docs.agno.com/memory/agent/overview",
    );
    expect(out).toContain("fetched_at: 2026-04-17T22:30:00.000Z");
    expect(out).toContain("title: Agent Memory");
    expect(out).toContain("\n---\n\n# Agent Memory");
  });

  test("trims leading whitespace from markdown body", () => {
    const out = serializePage(frontmatter, "\n\n   # Title\nbody");
    expect(out).toContain("\n---\n\n# Title");
  });

  test("output ends with a trailing newline", () => {
    const out = serializePage(frontmatter, "# Title");
    expect(out.endsWith("\n")).toBe(true);
  });
});
