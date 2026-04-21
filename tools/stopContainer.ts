import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_stopContainer";
const displayName = "Docker/stopContainer";

/**
 * Stop one or more Docker containers
 */
async function execute({ containers, time = 10, timeoutSeconds = 30 }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Convert single container to array
  if (containers.length === 0) {
    throw new Error(`[${name}] at least one container must be specified`);
  }

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker stop command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} stop`;

  // Add time parameter if it differs from default
  if (time !== 10) {
    cmd += ` -t ${shellEscape(String(time))}`;
  }

  // Append container identifiers
  cmd += ` ${containers.map(c => shellEscape(c)).join(" ")}`;

  agent.infoMessage(`[${name}] Stopping container(s): ${containers.join(", ")}...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  const { stdout, stderr, exitCode } = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  agent.infoMessage(`[${name}] Successfully stopped container(s): ${containers.join(", ")}`);
  return {
    summary: `Stopped container(s): ${containers.join(", ")}`,
    result: JSON.stringify({ ok: true, exitCode: exitCode ?? 0, stdout: stdout?.trim() || "", stderr: stderr?.trim() || "", containers: containers }),
  };
}

const description = "Stop one or more Docker containers";

const inputSchema = z.object({
  containers: z.array(z.string()).describe("Container ID(s) or name(s) to stop"),
  time: z.number().int().default(10).describe("Seconds to wait for stop before killing the container"),
  timeoutSeconds: z.number().int().default(30).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
