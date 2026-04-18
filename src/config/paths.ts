import { homedir } from "node:os";
import { join } from "node:path";

const DATA_DIR = process.env.DOCMOLE_DATA_DIR || join(homedir(), ".docmole");

export const paths = {
  root: DATA_DIR,
  projects: join(DATA_DIR, "projects"),
  project: (id: string) => join(DATA_DIR, "projects", id),
  projectConfig: (id: string) => join(DATA_DIR, "projects", id, "config.yaml"),
  projectPages: (id: string) => join(DATA_DIR, "projects", id, "pages"),
  projectPage: (id: string, relPath: string) =>
    join(DATA_DIR, "projects", id, "pages", relPath),
};
