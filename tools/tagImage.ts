import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_tagImage";
const displayName = "Docker/tagImage";

/**
 * Tag a Docker image
 */
async function execute({ sourceImage, targetImage, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 120);
  const dockerArgs = ["tag", sourceImage, targetImage];

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    summary: `Tagged Docker image ${sourceImage} as ${targetImage}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 120,
    contextLines: [`Source: ${sourceImage}`, `Target: ${targetImage}`],
    errorMessage: "Error while tagging Docker image",
  });
}

const description = "Tag a Docker image with a new name and/or tag";

const inputSchema = z.object({
  sourceImage: z.string().describe("The source image to tag"),
  targetImage: z.string().describe("The target image name and tag"),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(30),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
