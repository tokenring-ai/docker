import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_getContainerLogs";
const displayName = "Docker/getContainerLogs";

/**
 * Get logs from a Docker container
 */

async function execute(
  { name: containerName, follow, timestamps, since, until, tail, details, timeoutSeconds }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker logs command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 300));
  let cmd = `timeout ${timeout}s ${dockerCmd} logs`;

  if (follow) {
    cmd += ` --follow`;
  }

  if (timestamps) {
    cmd += ` --timestamps`;
  }

  if (since) {
    cmd += ` --since ${shellEscape(since)}`;
  }

  if (until) {
    cmd += ` --until ${shellEscape(until)}`;
  }

  cmd += ` --tail ${shellEscape(String(tail))}`;

  if (details) {
    cmd += ` --details`;
  }

  cmd += ` ${shellEscape(containerName)}`;

  agent.infoMessage(`[${name}] Getting logs from container ${containerName}...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 5 * 1024 * 1024,
    });

    const logs = stdout.trim();
    const logLines = logs.split("\n");

    agent.infoMessage(`[${name}] Successfully retrieved logs from container ${containerName}`);
    return {
      summary: `Retrieved ${logLines.length} log line(s) from container ${containerName}`,
      result: JSON.stringify({
        ok: true,
        exitCode,
        logs,
        lineCount: logLines.length,
        container: containerName,
        stdout: stdout.trim() || "",
        stderr: stderr.trim() || "",
      }),
    };
  } catch (err) {
    throw new ToolCallError(name, "Error while retrieving container logs", { cause: err });
  }
}

const description = "Get logs from a Docker container";

const inputSchema = z.object({
  name: z.string().describe("The container name or ID"),
  follow: z.boolean().exactOptional().default(false).describe("Whether to follow log output"),
  timestamps: z.boolean().exactOptional().default(false).describe("Whether to show timestamps"),
  since: z.string().exactOptional().describe("Show logs since timestamp (e.g. 2013-01-02T13:23:37Z) or relative (e.g. 42m for 42 minutes)"),
  until: z.string().exactOptional().describe("Show logs before a timestamp (e.g. 2013-01-02T13:23:37Z) or relative (e.g. 42m for 42 minutes)"),
  tail: z.number().int().exactOptional().default(100).describe("Number of lines to show from the end of the logs"),
  details: z.boolean().exactOptional().default(false).describe("Whether to show extra details provided to logs"),
  timeoutSeconds: z.number().default(120).default(30).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
