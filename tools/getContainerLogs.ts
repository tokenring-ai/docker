import {execa} from "execa";
import {shellEscape} from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import {z} from "zod";
import {DockerCommandResult} from "../types.ts";
import {Registry} from "@token-ring/registry";

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
): Promise<GetContainerLogsResult | string> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    chatService.errorLine(
      `[ERROR] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return "Couldn't perform Docker operation due to application misconfiguration, do not retry.";
  }

  if (!name) {
    chatService.errorLine("[getContainerLogs] name is required");
    return { error: "name is required" };
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

  // Add follow flag if specified
  if (follow) {
    cmd += ` --follow`;
  }

  // Add timestamps flag if specified
  if (timestamps) {
    cmd += ` --timestamps`;
  }

  // Add since parameter if specified
  if (since) {
    cmd += ` --since ${shellEscape(since)}`;
  }

  // Add until parameter if specified
  if (until) {
    cmd += ` --until ${shellEscape(until)}`;
  }

  // Add tail parameter
  cmd += ` --tail ${shellEscape(String(tail))}`;

  // Add details flag if specified
  if (details) {
    cmd += ` --details`;
  }

  // Add container name
  cmd += ` ${shellEscape(name)}`;

  chatService.infoLine(
    `[getContainerLogs] Getting logs from container ${name}...`,
  );
  chatService.infoLine(`[getContainerLogs] Executing: ${cmd}`);

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 5 * 1024 * 1024,
    });

    // Docker logs combines stdout and stderr by default
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
    return {
      ok: false,
      exitCode: typeof err.exitCode === "number" ? err.exitCode : 1,
      stdout: err.stdout?.trim() || "",
      stderr: err.stderr?.trim() || "",
      error: err.shortMessage || err.message,
    };
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