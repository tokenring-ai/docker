import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_pruneImages";
const displayName = "Docker/pruneImages";

/**
 * Prune unused Docker images
 */
async function execute({ all, filter, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 300);
  const dockerArgs = ["image", "prune", "-f"];

  if (all) {
    dockerArgs.push("-a");
  }

  if (filter) {
    dockerArgs.push("--filter", filter);
  }

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    summary: "Pruned unused Docker images",
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 300,
    contextLines: [`All unused: ${all}`],
    errorMessage: "Error while pruning Docker images",
  });
}

const description = "Prune unused Docker images";

const inputSchema = z.object({
  all: z.boolean().default(false).describe("Whether to remove all unused images, not just dangling ones"),
  filter: z.string().exactOptional().describe("Filter images based on conditions provided"),
  force: z.boolean().default(false).describe("Whether to force removal of images"),
  timeoutSeconds: z.number().default(120).default(60).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
