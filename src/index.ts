#!/usr/bin/env bun

import { listCommand } from "./cli/list";
import { searchCommand } from "./cli/search";
import { setupCommand } from "./cli/setup";

const CLI_NAME = "docmole";

function showHelp(): void {
  console.log(`
${CLI_NAME} — local markdown mirror of any documentation site, built for CLI agents

COMMANDS:
  setup    Discover + crawl pages into a local markdown tree, then build a search index
  search   BM25 keyword search over an indexed project; returns paths + snippets
  list     List all configured projects

SETUP OPTIONS:
  --url <url>     Documentation site URL (required)
  --id <id>       Project ID (lowercase, numbers, hyphens) (required)
  --name <name>   Display name (optional)
  --prefix <path> Only include pages under this path (optional)
  --skip-crawl    Save config and exit without fetching pages
  --verbose       Stream per-page fetch results to stderr
  --auth <ref>    Not yet supported — public docs only in this release.

SEARCH OPTIONS:
  --project <id>  Project to query (required)
  --limit <n>     Max results (default 5)
  --raw           Emit JSON array only (no framing). Designed for pipes.

EXAMPLES:
  ${CLI_NAME} setup --url https://docs.agno.com --id agno
  ${CLI_NAME} search --project agno "persist agent session storage"
  ${CLI_NAME} search --project agno --raw "auth ref resolution" | jq '.[0].abs'
  ${CLI_NAME} list
`);
}

interface ParsedArgs {
  command?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

const BOOLEAN_FLAGS = new Set(["help", "verbose", "raw", "skipCrawl"]);

function toCamel(key: string): string {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
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
      const camelKey = toCamel(arg.slice(2));
      if (BOOLEAN_FLAGS.has(camelKey)) {
        result.flags[camelKey] = true;
        continue;
      }
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        result.flags[camelKey] = next;
        i++;
      } else {
        result.flags[camelKey] = true;
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

    case "search": {
      const project = parsed.flags.project as string | undefined;
      const query = parsed.positional[0];
      if (!project || !query) {
        console.error(
          `Usage: ${CLI_NAME} search --project <id> "<query>" [--limit <n>] [--raw]`,
        );
        process.exit(1);
      }
      const limitFlag = parsed.flags.limit;
      const limit =
        typeof limitFlag === "string"
          ? Number.parseInt(limitFlag, 10)
          : undefined;
      if (limit !== undefined && (Number.isNaN(limit) || limit <= 0)) {
        console.error("Error: --limit must be a positive integer.");
        process.exit(1);
      }
      await searchCommand({
        project,
        query,
        limit,
        raw: Boolean(parsed.flags.raw),
      });
      break;
    }

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
