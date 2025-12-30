import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

type FormatType = "json" | "table" | string;

interface GetContainerStatsResult extends DockerCommandResult {
  stats?: any;
  containers?: string[];
}

/**
 * Get stats from a Docker container
 */

const name = "docker_getContainerStats";

async function execute(
  {
    containers,
    all = false,
    noStream = true,
    format = "json",
    timeoutSeconds = 10,
  }: z.infer<typeof inputSchema>,
  agent: Agent
): Promise<GetContainerStatsResult> {
  const dockerService = agent.requireServiceByType(DockerService);

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

  agent.infoLine(
    `[${name}] Getting stats for container(s): ${containerList.join(", ")}...`
  );
  agent.infoLine(`[${name}] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
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

    agent.infoLine(
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

const description = "Get stats from a Docker container";
const inputSchema = z
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

export default {
  name, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;