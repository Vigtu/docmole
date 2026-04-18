import YAML from "yaml";

export interface PageFrontmatter {
  source_url: string;
  fetched_at: string;
  title: string;
}

export function serializePage(
  frontmatter: PageFrontmatter,
  markdown: string,
): string {
  const yaml = YAML.stringify(frontmatter, { indent: 2 }).trimEnd();
  const body = markdown.replace(/^\s+/, "");
  return `---\n${yaml}\n---\n\n${body}\n`;
}
