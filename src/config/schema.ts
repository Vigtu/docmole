// Source auth reference. Resolved at crawl time.
//   keyring:<service>:<account>  → OS keyring (Bun.secrets)
//   localEnv:<VAR_NAME>          → process.env
export type AuthRef = `keyring:${string}:${string}` | `localEnv:${string}`;

const AUTH_REF_PATTERN = /^(?:keyring:[^:]+:[^:]+|localEnv:[^:]+)$/;
const PROJECT_ID_PATTERN = /^[a-z0-9-]+$/;

export function parseAuthRef(input: string): AuthRef | null {
  return AUTH_REF_PATTERN.test(input) ? (input as AuthRef) : null;
}

export function isValidProjectId(id: string): boolean {
  return PROJECT_ID_PATTERN.test(id);
}

export type DiscoveryMethod = "sitemap" | "mintjson";

export interface ProjectSource {
  url: string;
  prefix?: string;
  discovery?: DiscoveryMethod;
  auth?: AuthRef;
}

export interface IndexStatus {
  at?: string;
  pages_count?: number;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface ProjectConfig {
  id: string;
  name: string;
  created_at: string;
  source: ProjectSource;
  indexed?: IndexStatus;
}

export interface CreateProjectOptions {
  name?: string;
  prefix?: string;
  discovery?: DiscoveryMethod;
  auth?: AuthRef;
}

export function createDefaultProjectConfig(
  id: string,
  url: string,
  options: CreateProjectOptions = {},
): ProjectConfig {
  return {
    id,
    name: options.name || id,
    created_at: new Date().toISOString(),
    source: {
      url,
      prefix: options.prefix,
      discovery: options.discovery,
      auth: options.auth,
    },
    indexed: { status: "pending" },
  };
}
