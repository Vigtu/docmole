// Why this file exists
// ---------------------
// docmole is developed in Bun (fast TS execution, built-in test runner, zero
// build step during dev) but SHIPS as Node-compatible JavaScript. That way
// `npm install -g docmole` works on any machine with Node 18+ — no Bun
// required on the end user's box.
//
// This mirrors how playwright-cli, tsx, and most TS CLIs distribute: the dev
// surface (how contributors hack on the repo) is decoupled from the runtime
// surface (what gets installed from npm).
//
// `bun build --target=node` auto-prepends `#!/usr/bin/env bun` + `// @bun` to
// its output. We strip both and replace with a Node shebang so the published
// bin runs under plain Node.

import { chmod, readFile, writeFile } from "node:fs/promises";

const OUT = "dist/cli.js";
const NODE_SHEBANG = "#!/usr/bin/env node\n";

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  naming: "cli.js",
  target: "node",
  packages: "external",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const raw = await readFile(OUT, "utf-8");
const stripped = raw.replace(/^#!.*\r?\n/, "").replace(/^\/\/ @bun\r?\n/, "");
await writeFile(OUT, NODE_SHEBANG + stripped);
await chmod(OUT, 0o755);

console.log(`Built ${OUT}`);
