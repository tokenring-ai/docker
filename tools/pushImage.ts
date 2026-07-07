import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_pushImage";
const displayName = "Docker/pushImage";

/**
 * Push a Docker image to a registry
 */
async function execute({ tag, allTags, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 1800);
  const dockerArgs = ["push"];

  if (allTags) {
    dockerArgs.push("--all-tags");
  }

  dockerArgs.push(tag);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    summary: `Pushed Docker image ${tag}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 1800,
    contextLines: [`Tag: ${tag}`],
    errorMessage: "Error while pushing Docker image",
  });
}

const description = "Push a Docker image to a registry";
const inputSchema = z.object({
  tag: z.string().describe("The image tag to push"),
  allTags: z.boolean().describe("Whether to push all tags of the image").default(false),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(300),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
