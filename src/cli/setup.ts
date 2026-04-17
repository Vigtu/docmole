import { projectExists, saveProjectConfig } from "../config/loader";
import { paths } from "../config/paths";
import {
  type AuthRef,
  createDefaultProjectConfig,
  isValidProjectId,
  parseAuthRef,
} from "../config/schema";
import { discoverPages } from "../discovery";
import { redactUrl } from "../util/redact";

export interface SetupOptions {
  url: string;
  id: string;
  name?: string;
  prefix?: string;
  auth?: string;
  verbose?: boolean;
}

export async function setupCommand(options: SetupOptions): Promise<void> {
  const { url, id, name, prefix, auth, verbose = false } = options;

  console.log("\nSetting up documentation project...\n");

  if (!isValidProjectId(id)) {
    console.error(
      "Error: project id must contain only lowercase letters, numbers, and hyphens.",
    );
    process.exit(1);
  }

  if (await projectExists(id)) {
    console.error(`Error: project "${id}" already exists.`);
    process.exit(1);
  }

  const parsedUrl = parseUrl(url);
  const normalizedUrl = normalizeUrl(parsedUrl);
  const authRef = validateAuthFlag(auth);

  console.log(`Discovering pages from ${redactUrl(normalizedUrl)}...`);

  const discovery = await discoverPages(normalizedUrl, {
    prefix,
    method: "auto",
    verbose,
  });

  if (discovery.pages.length === 0) {
    console.error("Error: no pages found.");
    process.exit(1);
  }

  console.log(`Found ${discovery.pages.length} pages via ${discovery.method}`);

  const config = createDefaultProjectConfig(id, normalizedUrl, {
    name: name || siteNameFromHostname(parsedUrl.hostname),
    prefix,
    discovery: discovery.method,
    auth: authRef,
  });

  await saveProjectConfig(config);

  console.log(`Config saved to: ${paths.projectConfig(id)}`);
}

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    console.error(`Error: invalid URL: ${url}`);
    process.exit(1);
  }
}

function normalizeUrl(parsed: URL): string {
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(
    /\/$/,
    "",
  );
}

function validateAuthFlag(auth: string | undefined): AuthRef | undefined {
  if (!auth) return undefined;
  const ref = parseAuthRef(auth);
  if (ref) return ref;
  console.error(
    `Error: invalid --auth "${auth}". Expected "keyring:<service>:<account>" or "localEnv:<VAR>".`,
  );
  process.exit(1);
}

function siteNameFromHostname(hostname: string): string {
  const name = hostname
    .replace(/^(docs|www)\./, "")
    .replace(/\.(com|io|dev|ai|org|net)$/, "")
    .replace(/\./g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return `${name} Docs`;
}
