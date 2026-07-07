import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

/**
 * Docker Stack management tool: deploy, update, remove Docker stacks in local Docker Swarm mode
 */

const name = "docker_dockerStack";
const displayName = "Docker/dockerStack";

async function execute({ action, stackName, composeFile, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  let cmd: string;
  const timeout = Math.max(5, Math.min(timeoutSeconds, 600));

  switch (action) {
    case "deploy":
      if (!composeFile) {
        throw new ToolCallError(name, `composeFile required for deploy`);
      }
      cmd = `timeout ${timeout}s ${dockerCmd} stack deploy -c ${shellEscape(composeFile)} ${shellEscape(stackName)}`;
      break;
    case "remove":
      cmd = `timeout ${timeout}s ${dockerCmd} stack rm ${shellEscape(stackName)}`;
      break;
    case "ps":
      cmd = `timeout ${timeout}s ${dockerCmd} stack ps ${shellEscape(stackName)}`;
      break;
    default:
      throw new ToolCallError(name, `Unknown action: ${action as string}`);
  }

  agent.infoMessage(`[dockerStack] Executing: ${cmd}`);

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });
    agent.infoMessage(`[dockerStack] Successfully executed ${action} on stack ${stackName}`);
    return {
      summary: `Docker stack ${action} on "${stackName}" succeeded`,
      result: JSON.stringify({ ok: true, exitCode, stdout: stdout.trim() || "", stderr: stderr.trim() || "", error: undefined }),
    };
  } catch (err) {
    throw new ToolCallError(name, "Error while executing docker stack command", { cause: err });
  }
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
