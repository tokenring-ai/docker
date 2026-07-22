import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_getContainerLogs";
const displayName = "Docker/getContainerLogs";

/**
 * Get logs from a Docker container
 */

async function execute(
  { name: containerName, follow, timestamps, since, until, tail, details, timeoutSeconds }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 300);
  const dockerArgs = ["logs"];

  if (follow) {
    dockerArgs.push("--follow");
  }

  if (timestamps) {
    dockerArgs.push("--timestamps");
  }

  if (since) {
    dockerArgs.push("--since", since);
  }

  if (until) {
    dockerArgs.push("--until", until);
  }

  dockerArgs.push("--tail", String(tail));

  if (details) {
    dockerArgs.push("--details");
  }

  dockerArgs.push(containerName);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Container** Retrieved logs from ${containerName}`,
    resultLabel: `Retrieved logs from container ${containerName}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 300,
    contextLines: [`Container: ${containerName}`, `Tail: ${tail}`],
    errorMessage: "Error while retrieving container logs",
  });
}

const description = "Get logs from a Docker container";

const inputSchema = z.object({
  name: z.string().describe("The container name or ID"),
  follow: z.boolean().exactOptional().default(false).describe("Whether to follow log output"),
  timestamps: z.boolean().exactOptional().default(false).describe("Whether to show timestamps"),
  since: z.string().exactOptional().describe("Show logs since timestamp (e.g. 2013-01-02T13:23:37Z) or relative (e.g. 42m for 42 minutes)"),
  until: z.string().exactOptional().describe("Show logs before a timestamp (e.g. 2013-01-02T13:23:37Z) or relative (e.g. 42m for 42 minutes)"),
  tail: z.number().int().exactOptional().default(100).describe("Number of lines to show from the end of the logs"),
  details: z.boolean().exactOptional().default(false).describe("Whether to show extra details provided to logs"),
  timeoutSeconds: z.number().default(120).default(30).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
