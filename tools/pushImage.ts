import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_pushImage";
const displayName = "Docker/pushImage";

interface PushImageResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  tag: string;
}

/**
 * Push a Docker image to a registry
 */
async function execute(
  {tag, allTags = false, timeoutSeconds = 300}: z.output<typeof inputSchema>,
  agent: Agent,
) {
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

  agent.infoMessage(`[pushImage] Pushing image ${tag}...`);
  agent.infoMessage(`[pushImage] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 5 * 1024 * 1024,
  });

  agent.infoMessage(`[pushImage] Successfully pushed image ${tag}`);
  return {
    type: 'json' as const,
    data: {
      ok: true,
      exitCode: exitCode ?? 0,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      tag: tag,
    }
  };
}

const description = "Push a Docker image to a registry";
const inputSchema = z.object({
  tag: z.string().describe("The image tag to push"),
  allTags: z
    .boolean()
    .describe("Whether to push all tags of the image")
    .default(false)
    .optional(),
  timeoutSeconds: z
    .number()
    .int()
    .describe("Timeout in seconds")
    .default(300)
    .optional(),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;