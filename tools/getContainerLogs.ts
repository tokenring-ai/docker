import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

interface GetContainerLogsArgs {
  name: string;
  follow?: boolean;
  timestamps?: boolean;
  since?: string;
  until?: string;
  tail?: number;
  details?: boolean;
  timeoutSeconds?: number;
}

interface GetContainerLogsResult extends DockerCommandResult {
  logs?: string;
  lineCount?: number;
  container?: string;
}

/**
 * Get logs from a Docker container
 * @param args - Log retrieval parameters
 * @param registry - The package registry
 * @returns Container logs
 */

export async function execute(
  {
    name,
    follow = false,
    timestamps = false,
    since,
    until,
    tail = 100,
    details = false,
    timeoutSeconds = 30,
  }: GetContainerLogsArgs,
  registry: Registry
): Promise<GetContainerLogsResult | { error: string }> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);

  if (!dockerService) {
    chatService.errorLine(
      `[getContainerLogs] ERROR DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return {error: "DockerService not found, can't perform Docker operations without Docker connection details"};
  }

  if (!name) {
    chatService.errorLine("[getContainerLogs] name is required");
    return {error: "name is required"};
  }

  // Build Docker command with host and TLS settings
  let dockerCmd = "docker";

  // Add host if not using default
  if (dockerService.getHost() !== "unix:///var/run/docker.sock") {
    dockerCmd += ` -H ${shellEscape(dockerService.getHost())}`;
  }

  // Add TLS settings if needed
  const tlsConfig = dockerService.getTLSConfig();
  if (tlsConfig.tlsVerify) {
    dockerCmd += " --tls";

    if (tlsConfig.tlsCACert) {
      dockerCmd += ` --tlscacert=${shellEscape(tlsConfig.tlsCACert)}`;
    }

    if (tlsConfig.tlsCert) {
      dockerCmd += ` --tlscert=${shellEscape(tlsConfig.tlsCert)}`;
    }

    if (tlsConfig.tlsKey) {
      dockerCmd += ` --tlskey=${shellEscape(tlsConfig.tlsKey)}`;
    }
  }

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

  cmd += ` ${shellEscape(name)}`;

  chatService.infoLine(
    `[getContainerLogs] Getting logs from container ${name}...`,
  );
  chatService.infoLine(`[getContainerLogs] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 5 * 1024 * 1024,
    });

    const logs = stdout.trim();
    const logLines = logs.split("\n");

    chatService.systemLine(
      `[getContainerLogs] Successfully retrieved logs from container ${name}`,
    );
    return {
      ok: true,
      exitCode: exitCode,
      logs: logs,
      lineCount: logLines.length,
      container: name,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (err: any) {
    chatService.errorLine(`[getContainerLogs] Error: ${err.message}`);
    return {error: err.shortMessage || err.message};
  }
}

export const description = "Get logs from a Docker container";

export const parameters = z.object({
  name: z.string().describe("The container name or ID"),
  follow: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to follow log output"),
  timestamps: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to show timestamps"),
  since: z
    .string()
    .optional()
    .describe(
      "Show logs since timestamp (e.g. 2013-01-02T13:23:37Z) or relative (e.g. 42m for 42 minutes)",
    ),
  until: z
    .string()
    .optional()
    .describe(
      "Show logs before a timestamp (e.g. 2013-01-02T13:23:37Z) or relative (e.g. 42m for 42 minutes)",
    ),
  tail: z
    .number()
    .int()
    .optional()
    .default(100)
    .describe("Number of lines to show from the end of the logs"),
  details: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to show extra details provided to logs"),
  timeoutSeconds: z
    .number()
    .int()
    .optional()
    .default(30)
    .describe("Timeout in seconds"),
});