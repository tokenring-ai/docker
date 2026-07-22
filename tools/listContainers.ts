import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

/**
 * List Docker containers
 */

const name = "docker_listContainers";
const displayName = "Docker/listContainers";

async function execute({ all, quiet, limit, filter, size, format, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 120);
  const dockerArgs = ["ps"];

  if (all) {
    dockerArgs.push("-a");
  }

  if (quiet) {
    dockerArgs.push("-q");
  }

  if (limit) {
    dockerArgs.push("-n", String(limit));
  }

  if (filter) {
    dockerArgs.push("--filter", filter);
  }

  if (size) {
    dockerArgs.push("-s");
  }

  if (format === "json") {
    dockerArgs.push("--format", "{{json .}}");
  } else if (format !== "table") {
    dockerArgs.push("--format", format);
  }

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Container** Listed ${all ? "All" : "Running"} Containers`,
    resultLabel: `Showing ${all ? "All" : "Running"} Containers`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 120,
    contextLines: [`Format: ${format}`],
    errorMessage: "Error while listing Docker containers",
  });
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
