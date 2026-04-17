import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  isAgentRunning,
  isServerRunning,
} from "../backends/agno";
import { getBackend } from "../backends/registry";
import type { Backend } from "../backends/types";
import type { ProjectConfig } from "../config/schema";
import { startMcpServer } from "../server";
import { buildBackendOptions } from "./backend-options";
import { requireBackend, requireProjectConfig } from "./guards";
import { ensureProviderKeys } from "./prompt";
import { startServer, stopServer, waitForServer } from "./start";

// =============================================================================
// SERVE COMMAND - Start MCP server for AI assistants
// =============================================================================

/** Server startup timeout in milliseconds */
const SERVER_STARTUP_TIMEOUT_MS = 15_000;

export interface ServeOptions {
  project: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const { project } = options;

  const config = await requireProjectConfig(project);
  const backendType = config.backend;
  await requireBackend(backendType);

  let backend: Backend;
  switch (backendType) {
    case "mintlify":
      backend = await createMintlifyBackendFromConfig(config);
      break;
    case "embedded":
      backend = await createEmbeddedBackendFromConfig(config);
      break;
    case "agno":
      backend = await createAgnoBackendFromConfig(config, project);
      break;
  }

  console.error(`Starting MCP server for "${config.name}"...`);
  await startMcpServer(backend, config.name);
}

// =============================================================================
// BACKEND CREATION HELPERS
// =============================================================================

/**
 * Create Mintlify backend from project config
 */
async function createMintlifyBackendFromConfig(
  config: ProjectConfig,
): Promise<Backend> {
  const factory = await getBackend("mintlify");
  try {
    return factory.create(buildBackendOptions(config, "mintlify"));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/**
 * Create embedded backend from project config
 */
async function createEmbeddedBackendFromConfig(
  config: ProjectConfig,
): Promise<Backend> {
  if (!config.embedded?.local) {
    const ok = await ensureProviderKeys({
      llm: config.embedded?.llm_provider,
      embedding: config.embedded?.embedding_provider,
    });
    if (!ok) {
      console.error(
        "Tip: Reconfigure the project with --local flag for Ollama.",
      );
      process.exit(1);
    }
  }

  console.error(
    `Loading embedded backend (${config.embedded?.local ? "local" : "cloud"} mode)...`,
  );

  const factory = await getBackend("embedded");
  const backend = await factory.create(buildBackendOptions(config, "embedded"));

  const isAvailable = await backend.isAvailable();
  if (!isAvailable) {
    console.error(
      "Warning: Knowledge base is empty or unavailable. Run setup again.",
    );
  }

  return backend;
}

/**
 * Create Agno backend from project config. Starts the Python server if needed.
 */
async function createAgnoBackendFromConfig(
  config: ProjectConfig,
  project: string,
): Promise<Backend> {
  const host = config.agno?.host || DEFAULT_HOST;
  const port = config.agno?.port || DEFAULT_PORT;

  const agentExists = await isAgentRunning(project, port, host);

  if (!agentExists) {
    // Different project may be holding the port; stop it before starting ours.
    if (await isServerRunning(port, host)) {
      console.error(`Stopping existing server on port ${port}...`);
      await stopServer(port);
      await Bun.sleep(1000); // Wait for graceful shutdown
    }

    console.error(`Starting RAG server for "${project}" on port ${port}...`);

    const started = await startServer(project, port, false);
    if (!started) {
      console.error("Failed to start RAG server.");
      process.exit(1);
    }

    // Wait for server and agent to be ready
    const ready = await waitForServer(port, SERVER_STARTUP_TIMEOUT_MS, host);
    if (!ready) {
      console.error("RAG server did not become ready in time.");
      process.exit(1);
    }

    console.error("RAG server started.");
  }

  const factory = await getBackend("agno");
  return factory.create({
    projectId: project,
    host,
    port,
  });
}
