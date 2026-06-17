import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_pushImage";
const displayName = "Docker/pushImage";

/**
 * Push a Docker image to a registry
 */
async function execute({ tag, allTags, timeoutSeconds }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker push command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 1800)); // Max 30 minutes
  let cmd = `timeout ${timeout}s ${dockerCmd} push`;

  // Add all-tags flag if specified
  if (allTags) {
    cmd += ` --all-tags`;
  }

  // Add tag
  cmd += ` ${shellEscape(tag)}`;

  agent.infoMessage(`[${name}] Pushing image ${tag}...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  const { stdout, stderr, exitCode } = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 5 * 1024 * 1024,
  });

  agent.infoMessage(`[${name}] Successfully pushed image ${tag}`);
  return {
    summary: `Pushed Docker image ${tag}`,
    result: JSON.stringify({ ok: true, exitCode: exitCode ?? 0, stdout: stdout?.trim() || "", stderr: stderr?.trim() || "", tag }),
  };
}

const description = "Push a Docker image to a registry";
const inputSchema = z.object({
  tag: z.string().describe("The image tag to push"),
  allTags: z.boolean().describe("Whether to push all tags of the image").default(false),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(300),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
