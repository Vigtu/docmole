import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathExists } from "../util/fs";

const SKILL_NAME = "docmole";
// src/cli/install.ts → src/cli → src → <repo> = 3 ups in dev; dist/cli.js →
// dist → <pkg> = 2 ups when published. 5 leaves headroom without letting a
// missing package.json walk indefinitely up the filesystem.
const PACKAGE_ROOT_LOOKUP_LIMIT = 5;

// Claude Code only watches `.claude/skills/` directories that existed at
// session start. If we install a skill into a fresh dir while a session is
// already open, the agent won't pick it up until the user restarts.
export const RESTART_HINT =
  "Restart Claude Code if it was already open in this directory — new skill directories are only watched from session start.";

export interface InstallOptions {
  skills: boolean;
  force?: boolean;
  target?: string;
}

export async function installCommand(options: InstallOptions): Promise<void> {
  if (!options.skills) {
    console.error("Error: specify --skills to install the docmole skill.");
    process.exit(1);
  }

  const baseDir = options.target ?? process.cwd();
  const target = skillTarget(baseDir);

  if (!options.force && (await pathExists(target))) {
    console.error(`Error: ${target} already exists.`);
    console.error("Pass --force to overwrite.");
    process.exit(1);
  }

  await mkdir(dirname(target), { recursive: true });
  await cp(resolveBundledSkill(), target, {
    recursive: true,
    force: options.force,
  });
  console.log(`Installed docmole skill to ${target}`);
  console.log(RESTART_HINT);
}

// Idempotent install for `setup` auto-install. Returns the target path if the
// skill was written, or `null` if the skill was already present (skipped).
export async function writeSkill(baseDir: string): Promise<string | null> {
  const target = skillTarget(baseDir);
  if (await pathExists(target)) return null;
  await mkdir(dirname(target), { recursive: true });
  await cp(resolveBundledSkill(), target, { recursive: true });
  return target;
}

function skillTarget(baseDir: string): string {
  return resolve(baseDir, ".claude", "skills", SKILL_NAME);
}

// Walks up looking for package.json so this resolves correctly in BOTH
// layouts: dev (src/cli/install.ts → <repo>/skills) and published
// (dist/cli.js → <node_modules/docmole>/skills). Hard-coded relative paths
// would only work in one of the two.
function resolveBundledSkill(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < PACKAGE_ROOT_LOOKUP_LIMIT; i++) {
    if (existsSync(join(dir, "package.json"))) {
      return join(dir, "skills", SKILL_NAME);
    }
    dir = resolve(dir, "..");
  }
  throw new Error(`Could not locate docmole package root from ${here}`);
}
