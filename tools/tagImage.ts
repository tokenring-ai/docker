import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

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
 * @param {object} args
 * @param {string} args.sourceImage - The source image to tag
 * @param {string} args.targetImage - The target image name and tag
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the tag operation
 */
export async function execute(
  {sourceImage, targetImage, timeoutSeconds = 30}: {
    sourceImage: string;
    targetImage: string;
    timeoutSeconds: number
  },
  registry: Registry,
): Promise<TagImageResult | { error: string }> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    chatService.errorLine(
      `[tagImage] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return {error: "DockerService not found, can't perform Docker operations without Docker connection details"};
  }

  if (!sourceImage || !targetImage) {
    chatService.errorLine(
      "[tagImage] sourceImage and targetImage are required",
    );
    return {error: "sourceImage and targetImage are required"};
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

  chatService.infoLine(
    `[tagImage] Tagging image ${sourceImage} as ${targetImage}...`,
  );
  chatService.infoLine(`[tagImage] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });
  chatService.systemLine(
    `[tagImage] Successfully tagged image ${sourceImage} as ${targetImage}`,
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

export const description = "Tag a Docker image with a new name and/or tag";

export const parameters = z.object({
  sourceImage: z.string().describe("The source image to tag"),
  targetImage: z.string().describe("The target image name and tag"),
  timeoutSeconds: z
    .number()
    .int()
    .describe("Timeout in seconds")
    .default(30)
    .optional(),
});
