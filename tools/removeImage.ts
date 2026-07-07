import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

/**
 * Exported tool name in the format "packageName/toolName".
 */
const name = "docker_removeImage";
const displayName = "Docker/removeImage";

/**
 * Remove one or more Docker images
 */
async function execute({ images, force, noPrune, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (images.length === 0) {
    throw new ToolCallError(name, `at least one image must be specified`);
  }

  const timeout = clampTimeout(timeoutSeconds, 5, 120);
  const dockerArgs = ["rmi"];

  if (force) {
    dockerArgs.push("-f");
  }

  if (noPrune) {
    dockerArgs.push("--no-prune");
  }

  dockerArgs.push(...images);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    summary: `Removed Docker image(s): ${images.join(", ")}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 120,
    contextLines: [`Images: ${images.join(", ")}`],
    errorMessage: "Error while removing Docker image",
  });
}

const description = "Remove one or more Docker images";

const inputSchema = z
  .object({
    images: z.array(z.string()).describe("Image ID(s) or name(s) to remove"),
    force: z.boolean().exactOptional().default(false).describe("Whether to force removal of the image"),
    noPrune: z.boolean().exactOptional().default(false).describe("Whether to prevent the pruning of parent images"),
    timeoutSeconds: z.number().default(120).default(30).describe("Timeout in seconds"),
  })
  .strict();

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
