import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { TerminalService } from "@tokenring-ai/terminal";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, formatDockerCommandOutput } from "../util/executeDockerCommand.ts";

const name = "docker_dockerRun";
const displayName = "Docker/dockerRun";

/**
 * Runs a shell command in an ephemeral Docker container
 */
async function execute({ image, cmd, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const terminal = agent.requireServiceByType(TerminalService);
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds || 60, 5, 600);

  const dockerArgs = ["-v", `${process.cwd()}:/workdir:rw`, "-w", "/workdir", "run", "--rm", image, "sh", "-c", cmd];
  const commandArgs = ["timeout", `${timeout}s`, "docker", ...dockerService.buildDockerPrefixArgs(), ...dockerArgs];

  try {
    const result = await terminal.executeCommand(commandArgs[0]!, commandArgs.slice(1), { timeoutSeconds: timeout }, agent);

    if (result.status === "timeout") {
      throw new ToolCallError(name, "Error while running docker container", { cause: new Error("Command timed out") });
    }

    if (result.status === "unknownError") {
      throw new ToolCallError(name, "Error while running docker container", { cause: new Error(result.error) });
    }

    const exitCode = result.status === "badExitCode" ? result.exitCode : 0;
    const output = result.output;

    return formatDockerCommandOutput(`Ran docker container with image ${image}`, [`Command: ${cmd}`], exitCode, output);
  } catch (err) {
    if (err instanceof ToolCallError) {
      throw err;
    }
    throw new ToolCallError(name, "Error while running docker container", { cause: err });
  }
}

const description =
  "Runs a shell command in an ephemeral Docker container (docker run --rm). Returns the result (stdout, stderr, exit code). The base directory for the project is bind mounted at /workdir, and the working directory of the container is set to /workdir";

const inputSchema = z.object({
  image: z.string().describe("Docker image name (e.g., ubuntu:latest)"),
  cmd: z.string().describe("Command to run in the container (e.g., 'ls -l /')"),
  timeoutSeconds: z.number().default(120).describe("Timeout for the command, in seconds (default: 60)."),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
