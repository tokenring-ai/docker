import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/types";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

const name = "docker/tagImage";

interface TagImageResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  sourceImage: string;
  targetImage: string;
}

/**
 * Tag a Docker image
 */
async function execute(
  {
    sourceImage,
    targetImage,
    timeoutSeconds = 30,
  }: z.infer<typeof inputSchema>,
  agent: Agent,
): Promise<TagImageResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (!sourceImage || !targetImage) {
    throw new Error(`[${name}] sourceImage and targetImage are required`);
  }

  // Construct the docker tag command with Docker context settings
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));

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

  const cmd = `timeout ${timeout}s ${dockerCmd} tag ${shellEscape(sourceImage)} ${shellEscape(targetImage)}`;

  agent.infoLine(
    `[${name}] Tagging image ${sourceImage} as ${targetImage}...`,
  );
  agent.infoLine(`[${name}] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });
  agent.infoLine(
    `[${name}] Successfully tagged image ${sourceImage} as ${targetImage}`,
  );
  return {
    ok: true,
    exitCode: exitCode,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    sourceImage: sourceImage,
    targetImage: targetImage,
  };
}

const description = "Tag a Docker image with a new name and/or tag";

const inputSchema = z.object({
  sourceImage: z.string().describe("The source image to tag"),
  targetImage: z.string().describe("The target image name and tag"),
  timeoutSeconds: z
    .number()
    .int()
    .describe("Timeout in seconds")
    .default(30)
    .optional(),
});

export default {
  name, description, inputSchema, execute,
} as TokenRingToolDefinition<typeof inputSchema>;