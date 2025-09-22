import Agent from "@tokenring-ai/agent/Agent";
import {shellEscape} from "@tokenring-ai/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

export const name = "docker/pushImage";

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
export async function execute(
  {tag, allTags = false, timeoutSeconds = 300}: { tag: string; allTags: boolean; timeoutSeconds: number },
  agent: Agent,
): Promise<PushImageResult> {
  const dockerService = agent.requireServiceByType(DockerService);


  if (!tag) {
    throw new Error(`[${name}] tag is required`);
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

  // Construct the docker push command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 1800)); // Max 30 minutes
  let cmd = `timeout ${timeout}s ${dockerCmd} push`;

  // Add all-tags flag if specified
  if (allTags) {
    cmd += ` --all-tags`;
  }

  // Add tag
  cmd += ` ${shellEscape(tag)}`;

  agent.infoLine(`[pushImage] Pushing image ${tag}...`);
  agent.infoLine(`[pushImage] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 5 * 1024 * 1024,
  });

  agent.infoLine(`[pushImage] Successfully pushed image ${tag}`);
  return {
    ok: true,
    exitCode: exitCode,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    tag: tag,
  };
}

export const description = "Push a Docker image to a registry";
export const inputSchema = z.object({
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
