import type { BackendType } from "../backends/registry";
import { paths } from "../config/paths";
import type { ProjectConfig } from "../config/schema";

/**
 * Build the factory.create() options object for a backend from a ProjectConfig.
 * Callers still own side-effects (server lifecycle, logging, API-key prompts).
 */
export function buildBackendOptions(
  config: ProjectConfig,
  backendType: BackendType,
): Record<string, unknown> {
  switch (backendType) {
    case "mintlify":
      if (!config.mintlify) {
        throw new Error("Mintlify configuration missing in project config.");
      }
      return {
        projectId: config.mintlify.project_id,
        domain: config.mintlify.domain,
      };
    case "embedded":
      if (!config.embedded) {
        throw new Error("Embedded configuration missing in project config.");
      }
      return {
        projectId: config.id,
        projectPath: paths.project(config.id),
        local: config.embedded.local,
        llmProvider: config.embedded.llm_provider,
        llmModel: config.embedded.llm_model,
        embeddingProvider: config.embedded.embedding_provider,
        embeddingModel: config.embedded.embedding_model,
        ollamaBaseUrl: config.embedded.ollama_base_url,
      };
    case "agno":
      return {
        projectId: config.id,
        host: config.agno?.host,
        port: config.agno?.port,
      };
  }
}
