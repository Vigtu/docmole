import { getAllProjects } from "../config/loader";
import { redactUrl } from "../util/redact";

export async function listCommand(): Promise<void> {
  const projects = await getAllProjects();

  if (projects.length === 0) {
    console.log("No projects found.");
    console.log("\nCreate one with:");
    console.log("  docmole setup --url <docs-url> --id <project-id>");
    return;
  }

  console.log("Projects:\n");

  for (const project of projects) {
    const indexed = project.indexed;
    const statusLine = indexed
      ? `${indexed.status} (${indexed.pages_count ?? 0} pages)`
      : "not indexed";

    console.log(`  ${project.id}`);
    console.log(`    Name:   ${project.name}`);
    console.log(`    URL:    ${redactUrl(project.source.url)}`);
    console.log(`    Status: ${statusLine}`);

    if (project.source.prefix) {
      console.log(`    Prefix: ${project.source.prefix}`);
    }

    console.log();
  }

  console.log(`Total: ${projects.length} project(s)`);
}
