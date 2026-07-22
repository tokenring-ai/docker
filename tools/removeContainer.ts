import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

/**
 * Remove one or more Docker containers
 */

const name = "docker_removeContainer";
const displayName = "Docker/removeContainer";

async function execute({ containers, force, volumes, link, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (containers.length === 0) {
    throw new ToolCallError(name, `at least one container must be specified`);
  }

  const timeout = clampTimeout(timeoutSeconds, 5, 120);
  const dockerArgs = ["rm"];

  if (force) {
    dockerArgs.push("-f");
  }

  if (volumes) {
    dockerArgs.push("-v");
  }

  if (link) {
    dockerArgs.push("-l");
  }

  dockerArgs.push(...containers);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Container** Removed ${containers.join(", ")}`,
    resultLabel: `Removed container(s): ${containers.join(", ")}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 120,
    contextLines: [`Containers: ${containers.join(", ")}`],
    errorMessage: "Error while removing container",
  });
}

const description = "Remove one or more Docker containers";

const inputSchema = z.object({
  containers: z.array(z.string()).describe("Container ID(s) or name(s) to remove"),
  force: z.boolean().default(false).describe("Whether to force the removal of a running container"),
  volumes: z.boolean().default(false).describe("Whether to remove anonymous volumes associated with the container"),
  link: z.boolean().default(false).describe("Whether to remove the specified link"),
  timeoutSeconds: z.number().default(120).default(30).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
