import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";


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
  {images, force = false, noPrune = false, timeoutSeconds = 30}: {
    images: string[];
    force: boolean;
    noPrune: false;
    timeoutSeconds: number
  },
  registry: Registry,
): Promise<RemoveImageResult | { error: string }> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    chatService.errorLine(
      `[removeImage] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return {error: "DockerService not found, cannot perform Docker operations"};
  }

  if (!images) {
    chatService.errorLine("[removeImage] images is required");
    return {error: "images is required"};
  }

  // Convert single image to array
  const imageList = Array.isArray(images) ? images : [images];
  if (imageList.length === 0) {
    chatService.errorLine("[removeImage] at least one image must be specified");
    return {error: "at least one image must be specified"};
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

  chatService.infoLine(
    `[removeImage] Removing image(s): ${imageList.join(", ")}...`,
  );
  chatService.infoLine(`[removeImage] Executing: ${cmd}`);


  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  chatService.systemLine(
    `[removeImage] Successfully removed image(s): ${imageList.join(", ")}`,
  );
  return {
    ok: true,
    exitCode: exitCode,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    images: imageList,
  };
}

export const description = "Remove one or more Docker images";

export const parameters = z
  .object({
    images: z.array(z.string())
      .describe("Image ID(s) or name(s) to remove"),
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to force removal of the image"),
    noPrune: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to prevent the pruning of parent images"),
    timeoutSeconds: z
      .number()
      .int()
      .optional()
      .default(30)
      .describe("Timeout in seconds"),
  })
  .strict();
