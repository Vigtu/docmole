import { readdir } from "node:fs/promises";
import YAML from "yaml";
import { paths } from "./paths";
import type { ProjectConfig } from "./schema";

export async function loadProjectConfig(
  projectId: string,
): Promise<ProjectConfig | null> {
  try {
    const content = await Bun.file(paths.projectConfig(projectId)).text();
    return YAML.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function saveProjectConfig(config: ProjectConfig): Promise<void> {
  const content = YAML.stringify(config, { indent: 2 });
  await Bun.write(paths.projectConfig(config.id), content);
}

export async function getAllProjects(): Promise<ProjectConfig[]> {
  const ids = await readdir(paths.projects).catch(() => []);
  const configs = await Promise.all(ids.map(loadProjectConfig));
  return configs.filter((c): c is ProjectConfig => c !== null);
}

export async function projectExists(projectId: string): Promise<boolean> {
  return Bun.file(paths.projectConfig(projectId)).exists();
}
