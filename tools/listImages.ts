import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

type FormatType = "json" | "table" | string;

interface ListImagesArgs {
  all?: boolean;
  quiet?: boolean;
  digests?: boolean;
  filter?: string;
  format?: FormatType;
  timeoutSeconds?: number;
}

interface ListImagesResult extends DockerCommandResult {
  images?: any;
  count?: number;
}

/**
 * List Docker images
 */

export const name = "docker/listImages";

export async function execute(
  {
    all = false,
    quiet = false,
    digests = false,
    filter,
    format = "json",
    timeoutSeconds = 30,
  }: ListImagesArgs,
  registry: Registry,
): Promise<ListImagesResult> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    // Throw error instead of returning an object
    throw new Error(
      `[${name}] DockerService not found, can't perform Docker operations without Docker connection details`
    );
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

  // Construct the docker images command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} images`;

  // Add all flag if specified
  if (all) {
    cmd += ` -a`;
  }

  // Add quiet flag if specified
  if (quiet) {
    cmd += ` -q`;
  }

  // Add digests flag if specified
  if (digests) {
    cmd += ` --digests`;
  }

  // Add filter if specified
  if (filter) {
    cmd += ` --filter ${shellEscape(filter)}`;
  }

  // Add format
  if (format === "json") {
    cmd += ` --format '{{json .}}'`;
  } else if (format === "table") {
    // Default table format – no extra flag needed
  } else {
    // Custom format
    cmd += ` --format ${shellEscape(format)}`;
  }

  chatService.infoLine(`[${name}] Listing images...`);
  chatService.infoLine(`[${name}] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    // Parse the output
    let images: any;
    if (format === "json" && !quiet) {
      try {
        // Split by newline and parse each line as JSON
        images = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
      } catch (e: any) {
        chatService.errorLine(
          `[${name}] Error parsing JSON output: ${e.message}`
        );
        images = stdout.trim();
      }
    } else {
      images = stdout.trim();
    }

    chatService.systemLine(`[${name}] Successfully listed images`);
    return {
      ok: true,
      exitCode: exitCode,
      images: images,
      count: Array.isArray(images)
        ? images.length
        : stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim()).length,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
    };
  } catch (err: any) {
    // Throw error instead of returning an object
    throw new Error(`[${name}] Error: ${err.message}`);
  }
}

export const description = "List Docker images";

export const inputSchema = z.object({
  all: z
    .boolean()
    .default(false)
    .describe("Whether to show all images (default hides intermediate images)"),
  quiet: z
    .boolean()
    .default(false)
    .describe("Whether to only display image IDs"),
  digests: z.boolean().default(false).describe("Whether to show digests"),
  filter: z
    .string()
    .optional()
    .describe("Filter output based on conditions provided"),
  format: z
    .string()
    .default("json")
    .describe("Format the output (json or table)"),
  timeoutSeconds: z.number().int().default(30).describe("Timeout in seconds"),
});
