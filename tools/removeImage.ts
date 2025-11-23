import Agent from "@tokenring-ai/agent/Agent";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

/**
 * Exported tool name in the format "packageName/toolName".
 */
export const name = "docker/removeImage";

interface RemoveImageResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  images: string[];
}

/**
 * Remove one or more Docker images
 */
export async function execute(
  {
    images,
    force = false,
    noPrune = false,
    timeoutSeconds = 30,
  }: {
    images: string[];
    force: boolean;
    noPrune: boolean;
    timeoutSeconds: number;
  },
  agent: Agent,
): Promise<RemoveImageResult> {
  const dockerService = agent.requireServiceByType(DockerService);


  if (!images) {
    throw new Error(`[${name}] images is required`);
  }

  // Convert single image to array (images is already an array per type, but keep for safety)
  const imageList = Array.isArray(images) ? images : [images];
  if (imageList.length === 0) {
    throw new Error(`[${name}] at least one image must be specified`);
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
  cmd += ` ${imageList.map((image) => shellEscape(image)).join(" ")}`;

  // Informational messages using the standardized prefix
  agent.infoLine(
    `[${name}] Removing image(s): ${imageList.join(", ")}...`,
  );
  agent.infoLine(`[${name}] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  agent.infoLine(
    `[${name}] Successfully removed image(s): ${imageList.join(", ")}`,
  );

  return {
    ok: true,
    exitCode,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    images: imageList,
  };
}

export const description = "Remove one or more Docker images";

export const inputSchema = z
  .object({
    images: z.array(z.string()).describe("Image ID(s) or name(s) to remove"),
    force: z.boolean().optional().default(false).describe("Whether to force removal of the image"),
    noPrune: z.boolean().optional().default(false).describe("Whether to prevent the pruning of parent images"),
    timeoutSeconds: z.number().int().optional().default(30).describe("Timeout in seconds"),
  })
  .strict();
