import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

/**
 * Exported tool name in the format "packageName/toolName".
 */
const name = "docker_removeImage";
const displayName = "Docker/removeImage";

/**
 * Remove one or more Docker images
 */
async function execute({ images, force, noPrune, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Convert single image to array (images is already an array per type, but keep for safety)
  if (images.length === 0) {
    throw new ToolCallError(name, `at least one image must be specified`);
  }

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker rmi command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} rmi`;

  // Add force flag if specified
  if (force) {
    cmd += ` -f`;
  }

  // Add no-prune flag if specified
  if (noPrune) {
    cmd += ` --no-prune`;
  }

  // Add images
  cmd += ` ${images.map(image => shellEscape(image)).join(" ")}`;

  // Informational messages using the standardized prefix
  agent.infoMessage(`[${name}] Removing image(s): ${images.join(", ")}...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  const { stdout, stderr, exitCode } = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  agent.infoMessage(`[${name}] Successfully removed image(s): ${images.join(", ")}`);

  return {
    summary: `Removed Docker image(s): ${images.join(", ")}`,
    result: JSON.stringify({ ok: true, exitCode: exitCode ?? 0, stdout: stdout.trim() || "", stderr: stderr.trim() || "", images: images }),
  };
}

const description = "Remove one or more Docker images";

const inputSchema = z
  .object({
    images: z.array(z.string()).describe("Image ID(s) or name(s) to remove"),
    force: z.boolean().exactOptional().default(false).describe("Whether to force removal of the image"),
    noPrune: z.boolean().exactOptional().default(false).describe("Whether to prevent the pruning of parent images"),
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
