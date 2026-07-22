import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_startContainer";
const displayName = "Docker/startContainer";

/**
 * Start one or more Docker containers
 */
async function execute({ containers, attach, interactive, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (containers.length === 0) {
    throw new ToolCallError(name, `at least one container must be specified`);
  }

  const timeout = clampTimeout(timeoutSeconds, 5, 120);
  const dockerArgs = ["start"];

  if (attach) {
    dockerArgs.push("-a");
  }

  if (interactive) {
    dockerArgs.push("-i");
  }

  dockerArgs.push(...containers);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Container** Started ${containers.join(", ")}`,
    resultLabel: `Started container(s): ${containers.join(", ")}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 120,
    contextLines: [`Containers: ${containers.join(", ")}`],
    errorMessage: "Error while starting container",
  });
}

const description = "Start one or more Docker containers";

const inputSchema = z
  .object({
    containers: z.array(z.string()).describe("Container ID(s) or name(s) to start"),
    attach: z.boolean().exactOptional().default(false).describe("Whether to attach STDOUT/STDERR and forward signals"),
    interactive: z.boolean().exactOptional().default(false).describe("Whether to attach container's STDIN"),
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
