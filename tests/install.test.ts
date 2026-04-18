import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "src", "index.ts");

async function runCli(
  args: string[],
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

describe("install --skills", () => {
  test("copies SKILL.md into .claude/skills/docmole/", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "docmole-install-"));
    const { exitCode, stdout } = await runCli(["install", "--skills"], cwd);

    expect(exitCode).toBe(0);
    expect(stdout).toContain(".claude/skills/docmole");

    const skill = Bun.file(join(cwd, ".claude/skills/docmole/SKILL.md"));
    expect(await skill.exists()).toBe(true);
    expect(await skill.text()).toContain("name: docmole");
  });

  test("fails without --skills flag", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "docmole-install-"));
    const { exitCode, stderr } = await runCli(["install"], cwd);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--skills");
  });

  test("refuses to overwrite without --force", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "docmole-install-"));
    const existing = join(cwd, ".claude/skills/docmole");
    await mkdir(existing, { recursive: true });
    await writeFile(join(existing, "SKILL.md"), "custom");

    const { exitCode, stderr } = await runCli(["install", "--skills"], cwd);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--force");
    expect(await Bun.file(join(existing, "SKILL.md")).text()).toBe("custom");
  });

  test("--force overwrites existing skill", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "docmole-install-"));
    const existing = join(cwd, ".claude/skills/docmole");
    await mkdir(existing, { recursive: true });
    await writeFile(join(existing, "SKILL.md"), "custom");

    const { exitCode } = await runCli(["install", "--skills", "--force"], cwd);
    expect(exitCode).toBe(0);
    expect(await Bun.file(join(existing, "SKILL.md")).text()).toContain(
      "name: docmole",
    );
  });
});
