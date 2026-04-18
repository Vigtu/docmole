import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SKILL_NAME = "docmole";

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

  if (!options.force && (await dirExists(target))) {
    console.error(`Error: ${target} already exists.`);
    console.error("Pass --force to overwrite.");
    process.exit(1);
  }

  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: Boolean(options.force) });
  console.log(`Installed docmole skill to ${target}`);
}

function resolveBundledSkill(): string {
  return resolve(import.meta.dir, "..", "..", "skills", SKILL_NAME);
}

async function dirExists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}
