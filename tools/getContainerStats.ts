import { execa } from "execa";
import { z } from "zod";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import { DockerCommandResult } from "../types.ts";
import { Registry } from "@token-ring/registry";

type FormatType = "json" | "table" | string;

interface GetContainerStatsArgs {
  containers: string | string[];
  all?: boolean;
  noStream?: boolean;
  format?: FormatType;
  timeoutSeconds?: number;
}

interface GetContainerStatsResult extends DockerCommandResult {
  stats?: any;
  containers?: string[];
}

/**
 * Get stats from a Docker container
 * @param args - Stats retrieval parameters
 * @param registry - The package registry
 * @returns Container stats
 */

export async function execute(
  {
    containers,
    all = false,
    noStream = true,
    format = "json",
    timeoutSeconds = 10,
  }: GetContainerStatsArgs,
  registry: Registry
): Promise<GetContainerStatsResult | string> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    chatService.errorLine(
      `[ERROR] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return "Couldn't perform Docker operation due to application misconfiguration, do not retry.";
  }

  if (!containers) {
    chatService.errorLine("[getContainerStats] containers is required");
    return { error: "containers is required" };
  }

  // Convert single container to array
  const containerList = Array.isArray(containers) ? containers : [containers];
  if (containerList.length === 0) {
    chatService.errorLine(
      "[getContainerStats] at least one container must be specified",
    );
    return { error: "at least one container must be specified" };
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

  // Construct the docker stats command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 60));
  let cmd = `timeout ${timeout}s ${dockerCmd} stats`;

  // Add no-stream flag if specified
  if (noStream) {
    cmd += ` --no-stream`;
  }

  // Add all flag if specified
  if (all) {
    cmd += ` --all`;
  }

  // Add format
  if (format === "json") {
    cmd += ` --format '{{json .}}'`;
  } else if (format === "table") {
    // Default table format
  } else {
    // Custom format
    cmd += ` --format ${shellEscape(format)}`;
  }

  // Add containers
  cmd += ` ${containerList.map((container) => shellEscape(container)).join(" ")}`;

  chatService.infoLine(
    `[getContainerStats] Getting stats for container(s): ${containerList.join(", ")}...`,
  );
  chatService.infoLine(`[getContainerStats] Executing: ${cmd}`);

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    // Parse the output
    let stats: any;
    if (format === "json") {
      try {
        // Split by newline and parse each line as JSON
        stats = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
      } catch (e: any) {
        chatService.errorLine(
          `[getContainerStats] Error parsing JSON output: ${e.message}`,
        );
        stats = stdout.trim();
      }
    } else {
      stats = stdout.trim();
    }

    chatService.systemLine(
      `[getContainerStats] Successfully retrieved stats for container(s): ${containerList.join(", ")}`,
    );
    return {
      ok: true,
      exitCode: exitCode,
      stats: stats,
      containers: containerList,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (err: any) {
    chatService.errorLine(`[getContainerStats] Error: ${err.message}`);
    return {
      ok: false,
      exitCode: typeof err.exitCode === "number" ? err.exitCode : 1,
      stdout: err.stdout?.trim() || "",
      stderr: err.stderr?.trim() || "",
      error: err.shortMessage || err.message,
    };
  }
}

export const description = "Get stats from a Docker container";
export const parameters = z
  .object({
    containers: z
      .union([z.string(), z.array(z.string())])
      .describe("Container name(s) or ID(s)"),
    all: z
      .boolean()
      .default(false)
      .describe("Whether to show all containers (default shows just running)"),
    noStream: z
      .boolean()
      .default(true)
      .describe("Whether to disable streaming stats and only pull one stat"),
    format: z
      .string()
      .default("json")
      .describe("Format the output (json or table)"),
    timeoutSeconds: z.number().int().default(10).describe("Timeout in seconds"),
  })
  .strict();