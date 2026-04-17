const SENSITIVE_QUERY_PARAM = /token|key|secret|auth/i;

export function redactUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return input;
  }

  parsed.username = "";
  parsed.password = "";

  for (const name of Array.from(parsed.searchParams.keys())) {
    if (SENSITIVE_QUERY_PARAM.test(name)) {
      parsed.searchParams.set(name, "<redacted>");
    }
  }

  return parsed.toString();
}
