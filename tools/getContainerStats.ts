import ChatService from "@token-ring/chat/ChatService";
import { Registry } from "@token-ring/registry";
import { shellEscape } from "@token-ring/utility/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { DockerCommandResult } from "../types.ts";

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

export const name = "docker/getContainerStats";

export async function execute(
  {
    containers,
    all = false,
    noStream = true,
    format = "json",
    timeoutSeconds = 10,
  }: GetContainerStatsArgs,
  registry: Registry
): Promise<GetContainerStatsResult> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    throw new Error(`[${name}] DockerService not found, can't perform Docker operations without Docker connection details`);
  }

  if (!containers) {
    throw new Error(`[${name}] containers is required`);
  }

  // Convert single container to array
  const containerList = Array.isArray(containers) ? containers : [containers];
  if (containerList.length === 0) {
    throw new Error(`[${name}] at least one container must be specified`);
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
    `[${name}] Getting stats for container(s): ${containerList.join(", ")}...`
  );
  chatService.infoLine(`[${name}] Executing: ${cmd}`);

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
        throw new Error(`[${name}] Error parsing JSON output: ${e.message}`);
      }
    } else {
      stats = stdout.trim();
    }

    chatService.systemLine(
      `[${name}] Successfully retrieved stats for container(s): ${containerList.join(", ")}`
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
    throw new Error(`[${name}] Error: ${err.message}`);
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
