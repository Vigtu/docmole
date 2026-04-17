import { buildBackendOptions } from "./backend-options";
import { requireBackend, requireProjectConfig } from "./guards";
import { ensureProviderKeys } from "./prompt";

export interface AskOptions {
  project: string;
  question: string;
}

export async function askCommand(options: AskOptions): Promise<void> {
  const { project, question } = options;

  const config = await requireProjectConfig(project);
  const backendType = config.backend;
  const factory = await requireBackend(backendType);

  if (backendType === "embedded" && !config.embedded?.local) {
    const ok = await ensureProviderKeys({
      llm: config.embedded?.llm_provider,
      embedding: config.embedded?.embedding_provider,
    });
    if (!ok) process.exit(1);
  }

  let backendOptions: Record<string, unknown>;
  try {
    backendOptions = buildBackendOptions(config, backendType);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Retriever emits verbose debug output on stderr; mute it for one-shot ask.
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;

  try {
    const backend = await factory.create(backendOptions);
    const result = await backend.ask(question);
    process.stderr.write = originalStderrWrite;
    console.log(result.answer);
  } catch (err: unknown) {
    process.stderr.write = originalStderrWrite;
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("503") || msg.includes("high demand")) {
      console.error(
        "Error: Model is temporarily unavailable (503). Try again in a few seconds.",
      );
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  } finally {
    process.stderr.write = originalStderrWrite;
  }
}
