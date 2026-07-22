import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_pruneVolumes";
const displayName = "Docker/pruneVolumes";

/**
 * Prune unused Docker volumes
 */
async function execute({ filter, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 300);
  const dockerArgs = ["volume", "prune", "-f"];

  if (filter) {
    dockerArgs.push("--filter", filter);
  }

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Prune** Pruned unused volumes`,
    resultLabel: "Pruned unused Docker volumes",
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 300,
    errorMessage: "Error while pruning Docker volumes",
  });
}

const description = "Prune unused Docker volumes";

const inputSchema = z.object({
  filter: z.string().describe("Filter volumes based on conditions provided").exactOptional(),
  force: z.boolean().describe("Whether to force removal of volumes").default(false),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(60),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
