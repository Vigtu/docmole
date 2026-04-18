import { describe, expect, test } from "bun:test";
import { parseLlmsFullContent } from "../src/discovery/llmsfull";

const BASE = "https://example.com";

describe("parseLlmsFullContent", () => {
  test("parses a single page block", () => {
    const text = [
      "# Hello World",
      "URL: /intro",
      "Source: https://raw.githubusercontent.com/foo/bar/main/intro.mdx",
      "",
      "Welcome to the docs.",
    ].join("\n");

    const pages = parseLlmsFullContent(text, BASE);
    expect(pages).toEqual([
      {
        url: "https://example.com/intro",
        path: "/intro",
        title: "Hello World",
        content: "Welcome to the docs.",
      },
    ]);
  });

  test("parses multi-page block, preserving ## subheadings in body", () => {
    const text = [
      "# Page One",
      "URL: /one",
      "",
      "First page body.",
      "",
      "## Section inside",
      "",
      "more content",
      "",
      "# Page Two",
      "URL: /two",
      "",
      "Second page body.",
    ].join("\n");

    const pages = parseLlmsFullContent(text, BASE);
    expect(pages).toHaveLength(2);
    expect(pages[0].path).toBe("/one");
    expect(pages[0].content).toContain("## Section inside");
    expect(pages[0].content).toContain("more content");
    expect(pages[1].path).toBe("/two");
    expect(pages[1].content).toBe("Second page body.");
  });

  test("handles blocks without a Source line", () => {
    const text = ["# Bare", "URL: /bare", "", "body only"].join("\n");
    const pages = parseLlmsFullContent(text, BASE);
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe("Bare");
    expect(pages[0].content).toBe("body only");
  });

  test("normalizes path that lacks a leading slash", () => {
    const text = ["# X", "URL: foo/bar", "", "body"].join("\n");
    const pages = parseLlmsFullContent(text, BASE);
    expect(pages[0].path).toBe("/foo/bar");
    expect(pages[0].url).toBe("https://example.com/foo/bar");
  });

  test("ignores malformed blocks with no URL line", () => {
    const text = [
      "# No URL Here",
      "Source: https://x",
      "",
      "content",
      "",
      "# Valid",
      "URL: /ok",
      "",
      "ok content",
    ].join("\n");

    const pages = parseLlmsFullContent(text, BASE);
    expect(pages).toHaveLength(1);
    expect(pages[0].path).toBe("/ok");
  });

  test("returns empty for input without any `# ... URL:` pair", () => {
    expect(parseLlmsFullContent("", BASE)).toEqual([]);
    expect(
      parseLlmsFullContent("just some prose with no headers", BASE),
    ).toEqual([]);
  });
});
