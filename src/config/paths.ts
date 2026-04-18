import { homedir } from "node:os";
import { join } from "node:path";

function dataDir(): string {
  return process.env.DOCMOLE_DATA_DIR || join(homedir(), ".docmole");
}

export const paths = {
  get root() {
    return dataDir();
  },
  get projects() {
    return join(dataDir(), "projects");
  },
  project: (id: string) => join(dataDir(), "projects", id),
  projectConfig: (id: string) => join(dataDir(), "projects", id, "config.yaml"),
  projectPages: (id: string) => join(dataDir(), "projects", id, "pages"),
  projectPage: (id: string, relPath: string) =>
    join(dataDir(), "projects", id, "pages", relPath),
  projectSearchIndex: (id: string) =>
    join(dataDir(), "projects", id, "search-index.json"),
};
