import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_execInContainer";
const displayName = "Docker/execInContainer";

/**
 * Execute a command in a running Docker container
 */

async function execute(
  { container, commands, interactive, tty, workdir, env, privileged, user, timeoutSeconds }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (commands.length === 0) {
    throw new ToolCallError(name, `command cannot be empty`);
  }

  const timeout = clampTimeout(timeoutSeconds, 5, 300);
  const dockerArgs = ["exec"];

  if (interactive) {
    dockerArgs.push("-i");
  }

  if (tty) {
    dockerArgs.push("-t");
  }

  if (workdir) {
    dockerArgs.push("-w", workdir);
  }

  for (const [key, value] of Object.entries(env)) {
    dockerArgs.push("-e", `${key}=${value}`);
  }

  if (privileged) {
    dockerArgs.push("--privileged");
  }

  if (user) {
    dockerArgs.push("-u", user);
  }

  dockerArgs.push(container, ...commands);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Container** Executed ${commands.join(" ")} in ${container}`,
    resultLabel: `Executed command in container ${container}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 300,
    contextLines: [`Container: ${container}`, `Command: ${commands.join(" ")}`],
    errorMessage: "Error while executing command in container",
  });
}

const description = "Execute a command in a running Docker container";

const inputSchema = z.object({
  container: z.string().describe("Container name or ID"),
  commands: z.array(z.string()).describe("Commands to execute"),
  interactive: z.boolean().exactOptional().default(false).describe("Whether to keep STDIN open even if not attached"),
  tty: z.boolean().exactOptional().default(false).describe("Whether to allocate a pseudo-TTY"),
  workdir: z.string().exactOptional().describe("Working directory inside the container"),
  env: z.record(z.string(), z.string()).exactOptional().default({}).describe("Environment variables to set"),
  privileged: z.boolean().exactOptional().default(false).describe("Whether to give extended privileges to the command"),
  user: z.string().exactOptional().describe("Username or UID to execute the command as"),
  timeoutSeconds: z.number().default(120).default(30).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
