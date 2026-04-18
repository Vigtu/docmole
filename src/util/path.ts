// Input is untrusted: a malicious sitemap entry must not produce a path that
// escapes pages/. All rejection rules here exist to preserve that invariant.

const MAX_SEGMENTS = 16;
const MAX_SEGMENT_LENGTH = 200;
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars in untrusted URL segments is intentional
const UNSAFE_SEGMENT = /[\x00-\x1f/\\]|^\.+$/;

export class UnsafeUrlPathError extends Error {
  constructor(reason: string, input: string) {
    super(`unsafe url path (${reason}): ${input}`);
    this.name = "UnsafeUrlPathError";
  }
}

export function urlPathToFilePath(urlPath: string): string {
  let path: string;
  try {
    path = decodeURIComponent(urlPath);
  } catch {
    throw new UnsafeUrlPathError("invalid percent-encoding", urlPath);
  }

  const trailingSlash = path.endsWith("/");
  const rawSegments = path.split("/").filter((s) => s.length > 0);

  if (rawSegments.length > MAX_SEGMENTS) {
    throw new UnsafeUrlPathError("too many segments", urlPath);
  }

  const safeSegments: string[] = [];
  for (const segment of rawSegments) {
    if (UNSAFE_SEGMENT.test(segment)) {
      throw new UnsafeUrlPathError(`bad segment "${segment}"`, urlPath);
    }
    if (segment.length > MAX_SEGMENT_LENGTH) {
      throw new UnsafeUrlPathError("segment too long", urlPath);
    }
    safeSegments.push(segment);
  }

  if (safeSegments.length === 0) {
    return "index.md";
  }

  if (trailingSlash) {
    return `${safeSegments.join("/")}/index.md`;
  }

  const last = safeSegments[safeSegments.length - 1];
  const head = safeSegments.slice(0, -1);
  const leaf = last.endsWith(".md") ? last : `${last}.md`;
  return head.length > 0 ? `${head.join("/")}/${leaf}` : leaf;
}
