import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_tagImage";
const displayName = "Docker/tagImage";

/**
 * Tag a Docker image
 */
async function execute({ sourceImage, targetImage, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Construct the docker tag command with Docker context settings
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  const cmd = `timeout ${timeout}s ${dockerCmd} tag ${shellEscape(sourceImage)} ${shellEscape(targetImage)}`;

  agent.infoMessage(`[${name}] Tagging image ${sourceImage} as ${targetImage}...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  const { stdout, stderr, exitCode } = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });
  agent.infoMessage(`[${name}] Successfully tagged image ${sourceImage} as ${targetImage}`);
  return {
    summary: `Tagged Docker image ${sourceImage} as ${targetImage}`,
    result: JSON.stringify({ ok: true, exitCode: exitCode ?? 0, stdout: stdout?.trim() || "", stderr: stderr?.trim() || "", sourceImage, targetImage }),
  };
}

const description = "Tag a Docker image with a new name and/or tag";

const inputSchema = z.object({
  sourceImage: z.string().describe("The source image to tag"),
  targetImage: z.string().describe("The target image name and tag"),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(30),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
