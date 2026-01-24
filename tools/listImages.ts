import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

type FormatType = "json" | "table" | string;
interface ListImagesResult extends DockerCommandResult {
  images?: any;
  count?: number;
}

/**
 * List Docker images
 */

const name = "docker_listImages";
const displayName = "Docker/listImages";

async function execute(
  {
    all = false,
    quiet = false,
    digests = false,
    filter,
    format = "json",
    timeoutSeconds = 30,
  }: z.infer<typeof inputSchema>,
  agent: Agent,
): Promise<ListImagesResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

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

  agent.infoMessage(`[${name}] Listing images...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

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
        agent.errorMessage(
          `[${name}] Error parsing JSON output: ${e.message}`
        );
        images = stdout.trim();
      }
    } else {
      images = stdout.trim();
    }

    agent.infoMessage(`[${name}] Successfully listed images`);
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

const description = "List Docker images";

const inputSchema = z.object({
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

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;