import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function pathExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

export async function writeWithParents(
  path: string,
  data: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}
