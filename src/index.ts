#!/usr/bin/env bun

import { listCommand } from "./cli/list";
import { setupCommand } from "./cli/setup";

const CLI_NAME = "docmole";

function showHelp(): void {
  console.log(`
${CLI_NAME} — local markdown mirror of any documentation site, built for CLI agents

COMMANDS:
  setup   Discover + crawl pages into a local markdown tree
  list    List all configured projects

SETUP OPTIONS:
  --url <url>     Documentation site URL (required)
  --id <id>       Project ID (lowercase, numbers, hyphens) (required)
  --name <name>   Display name (optional)
  --prefix <path> Only include pages under this path (optional)
  --skip-crawl    Save config and exit without fetching pages
  --verbose       Stream per-page fetch results to stderr
  --auth <ref>    Not yet supported — public docs only in this release.

EXAMPLES:
  ${CLI_NAME} setup --url https://docs.agno.com --id agno
  ${CLI_NAME} setup --url https://react.dev --id react --prefix /learn
  ${CLI_NAME} list
`);
}

interface ParsedArgs {
  command?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = { flags: {}, positional: [] };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.flags.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.flags.verbose = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        result.flags[camelKey] = next;
        i++;
      } else {
        result.flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const next = args[i + 1];
      const longKey =
        key === "p"
          ? "project"
          : key === "n"
            ? "name"
            : key === "u"
              ? "url"
              : key === "i"
                ? "id"
                : key;

      if (next && !next.startsWith("-")) {
        result.flags[longKey] = next;
        i++;
      } else {
        result.flags[longKey] = true;
      }
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.positional.push(arg);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const parsed = parseArgs(args);

  if (parsed.flags.help) {
    showHelp();
    process.exit(0);
  }

  switch (parsed.command) {
    case "setup":
      if (!parsed.flags.url || !parsed.flags.id) {
        console.error("Error: --url and --id are required for setup command");
        console.error(
          `Usage: ${CLI_NAME} setup --url <docs-url> --id <project-id>`,
        );
        process.exit(1);
      }
      await setupCommand({
        url: parsed.flags.url as string,
        id: parsed.flags.id as string,
        name: parsed.flags.name as string | undefined,
        prefix: parsed.flags.prefix as string | undefined,
        auth: parsed.flags.auth as string | undefined,
        skipCrawl: Boolean(parsed.flags.skipCrawl),
        verbose: Boolean(parsed.flags.verbose),
      });
      break;

    case "list":
      await listCommand();
      break;

    case "help":
      showHelp();
      break;

    default:
      if (parsed.command) {
        console.error(`Unknown command: ${parsed.command}`);
        console.error(`Run '${CLI_NAME} --help' for usage information.`);
        process.exit(1);
      } else {
        showHelp();
      }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
