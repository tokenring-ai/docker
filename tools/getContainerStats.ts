import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

/**
 * Get stats from a Docker container
 */

const name = "docker_getContainerStats";
const displayName = "Docker/getContainerStats";

async function execute({ containers, all, noStream, format, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (containers.length === 0) {
    throw new ToolCallError(name, `at least one container must be specified`);
  }

  const timeout = clampTimeout(timeoutSeconds, 5, 60);
  const dockerArgs = ["stats"];

  if (noStream) {
    dockerArgs.push("--no-stream");
  }

  if (all) {
    dockerArgs.push("--all");
  }

  if (format === "json") {
    dockerArgs.push("--format", "{{json .}}");
  } else if (format !== "table") {
    dockerArgs.push("--format", format);
  }

  dockerArgs.push(...containers);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Stats** Retrieved container stats`,
    resultLabel: "Retrieved stats for container(s)",
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 60,
    contextLines: [`Containers: ${containers.join(", ")}`, `Format: ${format}`],
    errorMessage: "Error while getting container stats",
  });
}

const description = "Get stats from a Docker container";
const inputSchema = z
  .object({
    containers: z.array(z.string()).describe("Container name(s) or ID(s)"),
    all: z.boolean().default(false).describe("Whether to show all containers (default shows just running)"),
    noStream: z.boolean().default(true).describe("Whether to disable streaming stats and only pull one stat"),
    format: z.string().default("json").describe("Format the output (json or table)"),
    timeoutSeconds: z.number().default(120).default(10).describe("Timeout in seconds"),
  })
  .strict();

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
