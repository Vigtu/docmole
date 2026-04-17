import {
  type BackendFactory,
  type BackendType,
  loadBackend,
} from "../backends/registry";
import { loadProjectConfig } from "../config/loader";
import type { ProjectConfig } from "../config/schema";

/**
 * Load a project config or print a friendly error and exit.
 */
export async function requireProjectConfig(
  project: string,
): Promise<ProjectConfig> {
  const config = await loadProjectConfig(project);
  if (!config) {
    console.error(`Project "${project}" not found.`);
    console.error("Run 'list' command to see available projects.");
    process.exit(1);
  }
  return config;
}

/**
 * Load a backend factory or print its full error (message/details/suggestion) and exit.
 */
export async function requireBackend(
  backendType: BackendType,
): Promise<BackendFactory> {
  const result = await loadBackend(backendType);
  if (!result.success) {
    const { error } = result;
    console.error(`\nBackend Error: ${error.message}`);
    if (error.details) console.error(`Details: ${error.details}`);
    if (error.suggestion) console.error(`\n${error.suggestion}`);
    process.exit(1);
  }
  return result.factory;
}
