import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

/**
 * Docker Stack management tool: deploy, update, remove Docker stacks in local Docker Swarm mode
 */

const name = "docker_dockerStack";
const displayName = "Docker/dockerStack";

async function execute({ action, stackName, composeFile, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 600);
  let dockerArgs: string[];

  switch (action) {
    case "deploy":
      if (!composeFile) {
        throw new ToolCallError(name, `composeFile required for deploy`);
      }
      dockerArgs = ["stack", "deploy", "-c", composeFile, stackName];
      break;
    case "remove":
      dockerArgs = ["stack", "rm", stackName];
      break;
    case "ps":
      dockerArgs = ["stack", "ps", stackName];
      break;
    default:
      throw new ToolCallError(name, `Unknown action: ${action as string}`);
  }

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Swarm** ${action} ${stackName}`,
    resultLabel: `Docker stack ${action} on "${stackName}" succeeded`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 600,
    contextLines: [`Action: ${action}`, `Stack: ${stackName}`],
    errorMessage: "Error while executing docker stack command",
  });
}

const description = "Launch, update, or remove a Docker stack from the local Docker Swarm. Actions: deploy (requires composeFile), remove, ps.";

const inputSchema = z.object({
  action: z.enum(["deploy", "remove", "ps"]).describe("Action to perform: 'deploy', 'remove', or 'ps'."),
  stackName: z.string().describe("Name of the stack to deploy/remove/list."),
  composeFile: z.string().describe("Path to docker-compose.yml file (required for deploy)").exactOptional(),
  timeoutSeconds: z.number().default(120).describe("Timeout for the stack operation in seconds (default: 60)."),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
