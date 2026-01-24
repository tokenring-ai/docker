import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {FileSystemService} from "@tokenring-ai/filesystem";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import type {DockerCommandResult} from "../types.ts";

const name = "docker_dockerRun";
const displayName = "Docker/dockerRun";

/**
 * Runs a shell command in an ephemeral Docker container
 */
async function execute(
  {image, cmd, timeoutSeconds = 60}: z.infer<typeof inputSchema>,
  agent: Agent
): Promise<DockerCommandResult> {
  const filesystem = agent.requireServiceByType(FileSystemService);
  const dockerService = agent.requireServiceByType(DockerService);

  if (!image || !cmd) {
    throw new Error(`[${name}] image and cmd required`);
  }

  // Build Docker command arguments
  const dockerArgs: string[] = ["run", "--rm"];

  // Add host if not using default
  if (dockerService.options.host) {
    dockerArgs.unshift("-H", dockerService.options.host);
  }

  const {tls} = dockerService.options;
  // Add TLS settings if needed
  if (tls?.verify) {
    dockerArgs.unshift("--tls");

    if (tls.caCert) {
      dockerArgs.unshift(`--tlscacert=${tls.caCert}`);
    }

    if (tls.cert) {
      dockerArgs.unshift(`--tlscert=${tls.cert}`);
    }

    if (tls.key) {
      dockerArgs.unshift(`--tlskey=${tls.key}`);
    }
  }

  // Add image and command
  dockerArgs.push(image, "sh", "-c", cmd);

  const timeout = Math.max(5, Math.min(timeoutSeconds || 60, 600));

  // Create the final command with timeout
  const finalCommand: string[] = ["timeout", `${timeout}s`, "docker -v `pwd`:/workdir:rw -w /workdir ", ...dockerArgs];

  agent.infoMessage(`[${name}] Executing: ${finalCommand.join(" ")}`);

  try {
    const result = await filesystem.executeCommand(finalCommand, {
      timeoutSeconds: timeout,
    }, agent);

    return {
      ok: result.ok,
      exitCode: result.exitCode,
      stdout: result.stdout?.trim() || "",
      stderr: result.stderr?.trim() || "",
      error: result.ok
        ? undefined
        : `Command failed with exit code ${result.exitCode}`,
    };
  } catch (err: any) {
    throw new Error(`[${name}] ${err.message}`);
  }
}

const description =
  "Runs a shell command in an ephemeral Docker container (docker run --rm). Returns the result (stdout, stderr, exit code). The base directory for the project is bind mounted at /workdir, and the working directory of the container is set to /workdir";

const inputSchema = z.object({
  image: z.string().describe("Docker image name (e.g., ubuntu:latest)"),
  cmd: z.string().describe("Command to run in the container (e.g., 'ls -l /')"),
  timeoutSeconds: z
    .number()
    .int()
    .optional()
    .describe("Timeout for the command, in seconds (default: 60)."),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;