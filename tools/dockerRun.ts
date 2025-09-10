import Agent from "@tokenring-ai/agent/Agent";
import {FileSystemService} from "@tokenring-ai/filesystem";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import type {DockerCommandResult} from "../types.ts";

export const name = "docker/dockerRun";

interface DockerRunArgs {
  image?: string;
  cmd?: string;
  workdir?: string;
  timeoutSeconds?: number;
  mountSrc?: string;
}

/**
 * Runs a shell command in an ephemeral Docker container
 */
export async function execute(
  {image, cmd, workdir, timeoutSeconds = 60, mountSrc}: DockerRunArgs,
  agent: Agent
): Promise<DockerCommandResult> {
  const filesystem = agent.requireFirstServiceByType(FileSystemService);
  const dockerService = agent.requireFirstServiceByType(DockerService);

  if (!image || !cmd) {
    throw new Error(`[${name}] image and cmd required`);
  }

  // Build Docker command arguments
  const dockerArgs: string[] = ["run", "--rm"];

  // Add host if not using default
  if (dockerService.getHost() !== "unix:///var/run/docker.sock") {
    dockerArgs.unshift("-H", dockerService.getHost());
  }

  // Add TLS settings if needed
  const tlsConfig = dockerService.getTLSConfig();
  if (tlsConfig.tlsVerify) {
    dockerArgs.unshift("--tls");

    if (tlsConfig.tlsCACert) {
      dockerArgs.unshift(`--tlscacert=${tlsConfig.tlsCACert}`);
    }

    if (tlsConfig.tlsCert) {
      dockerArgs.unshift(`--tlscert=${tlsConfig.tlsCert}`);
    }

    if (tlsConfig.tlsKey) {
      dockerArgs.unshift(`--tlskey=${tlsConfig.tlsKey}`);
    }
  }

  // Add working directory
  if (workdir) {
    dockerArgs.push("-w", workdir);
  }

  // Add mount if specified
  if (mountSrc) {
    try {
      const base = filesystem.getBaseDirectory();
      dockerArgs.push("-v", `${base}:${mountSrc}`);
    } catch (_e) {
      // If base directory is not available, skip mounting
    }
  }

  // Add image and command
  dockerArgs.push(image, "sh", "-c", cmd);

  const timeout = Math.max(5, Math.min(timeoutSeconds || 60, 600));

  // Create the final command with timeout
  const finalCommand: string[] = ["timeout", `${timeout}s`, "docker", ...dockerArgs];

  agent.infoLine(`[${name}] Executing: ${finalCommand.join(" ")}`);

  try {
    const result = await filesystem.executeCommand(finalCommand, {
      timeoutSeconds: timeout,
    });

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

export const description =
  "Runs a shell command in an ephemeral Docker container (docker run --rm). Returns the result (stdout, stderr, exit code). Now also supports mounting the source directory at a custom path.";

export const inputSchema = z.object({
  image: z.string().describe("Docker image name (e.g., ubuntu:latest)"),
  cmd: z.string().describe("Command to run in the container (e.g., 'ls -l /')"),
  workdir: z
    .string()
    .optional()
    .describe("Working directory inside the container (optional)"),
  timeoutSeconds: z
    .number()
    .int()
    .optional()
    .describe("Timeout for the command, in seconds (default: 60)."),
  mountSrc: z
    .string()
    .optional()
    .describe(
      "Bind-mount the source directory at this target path inside the container (optional)",
    ),
});