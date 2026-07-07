import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

// Export tool name for consistent messaging
const name = "docker_startContainer";
const displayName = "Docker/startContainer";

/**
 * Start one or more Docker containers
 */
async function execute({ containers, attach, interactive, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Convert single container to array (maintained for backward compatibility)
  if (containers.length === 0) {
    throw new ToolCallError(name, `at least one container must be specified`);
  }

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker start command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} start`;

  // Add attach flag if specified
  if (attach) {
    cmd += ` -a`;
  }

  // Add interactive flag if specified
  if (interactive) {
    cmd += ` -i`;
  }

  // Add containers
  cmd += ` ${containers.map(container => shellEscape(container)).join(" ")}`;

  agent.infoMessage(`[${name}] Starting container(s): ${containers.join(", ")}...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  const { stdout, stderr, exitCode } = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  agent.infoMessage(`[${name}] Successfully started container(s): ${containers.join(", ")}`);
  return {
    summary: `Started container(s): ${containers.join(", ")}`,
    result: JSON.stringify({ ok: true, exitCode: exitCode ?? 0, stdout: stdout.trim() || "", stderr: stderr.trim() || "", containers: containers }),
  };
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
