export function extractTitle(content: string, fallbackPath: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  const lastSegment =
    fallbackPath.split("/").filter(Boolean).pop() || "Untitled";
  return lastSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
