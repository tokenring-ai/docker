import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

/**
 * List Docker images
 */

const name = "docker_listImages";
const displayName = "Docker/listImages";

async function execute({ all, quiet, digests, filter, format, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 120);
  const dockerArgs = ["images"];

  if (all) {
    dockerArgs.push("-a");
  }

  if (quiet) {
    dockerArgs.push("-q");
  }

  if (digests) {
    dockerArgs.push("--digests");
  }

  if (filter) {
    dockerArgs.push("--filter", filter);
  }

  if (format === "json") {
    dockerArgs.push("--format", "{{json .}}");
  } else if (format !== "table") {
    dockerArgs.push("--format", format);
  }

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    summary: `Showing ${all ? "All" : "Non-intermediate"} Images(s)`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 120,
    contextLines: [`Format: ${format}`],
    errorMessage: "Error while listing Docker images",
  });
}

const description = "List Docker images";

const inputSchema = z.object({
  all: z.boolean().default(false).describe("Whether to show all images (default hides intermediate images)"),
  quiet: z.boolean().default(false).describe("Whether to only display image IDs"),
  digests: z.boolean().default(false).describe("Whether to show digests"),
  filter: z.string().exactOptional().describe("Filter output based on conditions provided"),
  format: z.string().default("json").describe("Format the output (json or table)"),
  timeoutSeconds: z.number().default(120).default(30).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
