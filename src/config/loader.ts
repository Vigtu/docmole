import { readdir, readFile } from "node:fs/promises";
import YAML from "yaml";
import { pathExists, writeWithParents } from "../util/fs";
import { paths } from "./paths";
import type { ProjectConfig } from "./schema";

export async function loadProjectConfig(
  projectId: string,
): Promise<ProjectConfig | null> {
  try {
    const content = await readFile(paths.projectConfig(projectId), "utf-8");
    return YAML.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function saveProjectConfig(config: ProjectConfig): Promise<void> {
  await writeWithParents(
    paths.projectConfig(config.id),
    YAML.stringify(config, { indent: 2 }),
  );
}

export async function getAllProjects(): Promise<ProjectConfig[]> {
  const ids = await readdir(paths.projects).catch(() => []);
  const configs = await Promise.all(ids.map(loadProjectConfig));
  return configs.filter((c): c is ProjectConfig => c !== null);
}

export async function projectExists(projectId: string): Promise<boolean> {
  return pathExists(paths.projectConfig(projectId));
}
