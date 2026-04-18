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

  const source = resolveBundledSkill();
  const target = resolve(
    options.target ?? process.cwd(),
    ".claude",
    "skills",
    SKILL_NAME,
  );

  if (!options.force && (await pathExists(target))) {
    console.error(`Error: ${target} already exists.`);
    console.error("Pass --force to overwrite.");
    process.exit(1);
  }

  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: Boolean(options.force) });
  console.log(`Installed docmole skill to ${target}`);
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
