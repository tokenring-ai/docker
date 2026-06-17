import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

/**
 * List Docker containers
 */

const name = "docker_listContainers";
const displayName = "Docker/listContainers";

async function execute(
  { all , quiet , limit, filter, size , format , timeoutSeconds  }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker ps command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} ps`;

  // Add all flag if specified
  if (all) {
    cmd += ` -a`;
  }

  // Add quiet flag if specified
  if (quiet) {
    cmd += ` -q`;
  }

  // Add limit if specified
  if (limit) {
    cmd += ` -n ${shellEscape(String(limit))}`;
  }

  // Add filter if specified
  if (filter) {
    cmd += ` --filter ${shellEscape(filter)}`;
  }

  // Add size flag if specified
  if (size) {
    cmd += ` -s`;
  }

  // Add format
  if (format === "json") {
    cmd += ` --format '{{json .}}'`;
  } else if (format === "table") {
    // Default table format
  } else {
    // Custom format
    cmd += ` --format ${shellEscape(format)}`;
  }

  agent.infoMessage(`[${name}] Listing containers...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    // Parse the output
    let containers: any;
    if (format === "json" && !quiet) {
      try {
        // Split by newline and parse each line as JSON
        containers = stdout
          .trim()
          .split("\n")
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
      } catch (e: any) {
        // Throw parsing error instead of returning error object
        throw new Error(`[${name}] Error parsing JSON output: ${e.message}`);
      }
    } else {
      containers = stdout.trim();
    }

    agent.infoMessage(`[${name}] Successfully listed containers`);
    const count = Array.isArray(containers)
      ? containers.length
      : stdout
          .trim()
          .split("\n")
          .filter(line => line.trim()).length;
    return {
      summary: `Listed ${count} Docker container(s)`,
      result: JSON.stringify({ ok: true, exitCode, containers, count, stdout: stdout?.trim() || "", stderr: stderr?.trim() || "" }),
    };
  } catch (err: any) {
    // Throw error instead of returning error object
    throw new Error(`[${name}] Error: ${err.message}`);
  }
}

const description = "List Docker containers";

const inputSchema = z.object({
  all: z.boolean().describe("Whether to show all containers (default shows just running)").default(false),
  quiet: z.boolean().describe("Whether to only display container IDs").default(false),
  limit: z.number().int().describe("Number of containers to show").exactOptional(),
  filter: z.string().describe("Filter output based on conditions provided").exactOptional(),
  size: z.boolean().describe("Display total file sizes").default(false),
  format: z.string().describe("Format the output (json or table)").default("json"),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(30),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
