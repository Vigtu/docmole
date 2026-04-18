import YAML from "yaml";
import type { PageFrontmatter } from "../crawler/frontmatter";

const FRONTMATTER_START = "---\n";
const FRONTMATTER_END = "\n---\n";

export interface ParsedPage {
  frontmatter: PageFrontmatter;
  body: string;
}

export function parsePage(content: string): ParsedPage | null {
  if (!content.startsWith(FRONTMATTER_START)) return null;

  const rest = content.slice(FRONTMATTER_START.length);
  const end = rest.indexOf(FRONTMATTER_END);
  if (end === -1) return null;

  const yaml = rest.slice(0, end);
  const body = rest.slice(end + FRONTMATTER_END.length).replace(/^\n/, "");

  let frontmatter: PageFrontmatter;
  try {
    frontmatter = YAML.parse(yaml) as PageFrontmatter;
  } catch {
    return null;
  }

  if (
    !frontmatter ||
    typeof frontmatter.title !== "string" ||
    typeof frontmatter.source_url !== "string"
  ) {
    return null;
  }

  return { frontmatter, body };
}
