import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

type FormatType = "json" | "table" | string;

interface ListContainersArgs {
  all?: boolean;
  quiet?: boolean;
  limit?: number;
  filter?: string;
  size?: boolean;
  format?: FormatType;
  timeoutSeconds?: number;
}

interface ListContainersResult extends DockerCommandResult {
  containers?: any;
  count?: number;
}

/**
 * List Docker containers
 * @param args - List containers parameters
 * @param registry - The package registry
 * @returns List of containers
 */

const TOOL_NAME = "listContainers";

export async function execute(
  {
    all = false,
    quiet = false,
    limit,
    filter,
    size = false,
    format = "json",
    timeoutSeconds = 30,
  }: ListContainersArgs,
  registry: Registry
): Promise<ListContainersResult | string> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    chatService.errorLine(
      `[${TOOL_NAME}] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return {error: "DockerService not found, cannot perform Docker operations"};
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

  // Construct the docker ps command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} ps`;

  // Add all flag if specified
  if (all) {
    cmd += ` -a`;
  }

  // Add quiet flag if specified
  if (quiet) {
    cmd += ` -q`;
  }

  // Add limit if specified
  if (limit) {
    cmd += ` -n ${shellEscape(String(limit))}`;
  }

  // Add filter if specified
  if (filter) {
    cmd += ` --filter ${shellEscape(filter)}`;
  }

  // Add size flag if specified
  if (size) {
    cmd += ` -s`;
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

  chatService.infoLine(`[${TOOL_NAME}] Listing containers...`);
  chatService.infoLine(`[${TOOL_NAME}] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    // Parse the output
    let containers: any;
    if (format === "json" && !quiet) {
      try {
        // Split by newline and parse each line as JSON
        containers = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
      } catch (e: any) {
        chatService.errorLine(
          `[${TOOL_NAME}] Error parsing JSON output: ${e.message}`,
        );
        containers = stdout.trim();
      }
    } else {
      containers = stdout.trim();
    }

    chatService.systemLine(`[${TOOL_NAME}] Successfully listed containers`);
    return {
      ok: true,
      exitCode: exitCode,
      containers: containers,
      count: Array.isArray(containers)
        ? containers.length
        : stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim()).length,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (err: any) {
    chatService.errorLine(`[${TOOL_NAME}] Error: ${err.message}`);
    return {error: err.message};
  }
}

export const description = "List Docker containers";

export const parameters = z.object({
  all: z
    .boolean()
    .describe("Whether to show all containers (default shows just running)")
    .default(false),
  quiet: z
    .boolean()
    .describe("Whether to only display container IDs")
    .default(false),
  limit: z.number().int().describe("Number of containers to show").optional(),
  filter: z
    .string()
    .describe("Filter output based on conditions provided")
    .optional(),
  size: z.boolean().describe("Display total file sizes").default(false),
  format: z
    .string()
    .describe("Format the output (json or table)")
    .default("json"),
  timeoutSeconds: z.number().int().describe("Timeout in seconds").default(30),
});