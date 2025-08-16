import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

interface BuildImageArgs {
  context: string;
  tag: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
  noCache?: boolean;
  pull?: boolean;
  timeoutSeconds?: number;
}

interface BuildResult extends DockerCommandResult {
  tag?: string;
}

/**
 * Build a Docker image
 * @param args - Build parameters
 * @param registry - The package registry
 * @returns Result of the build operation
 */

export async function execute(
  {
    context,
    tag,
    dockerfile,
    buildArgs = {},
    noCache = false,
    pull = false,
    timeoutSeconds = 300,
  }: BuildImageArgs,
  registry: Registry
): Promise<BuildResult | { error: string }> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    chatService.errorLine(
      `[buildImage] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return {error: "DockerService not found, can't perform Docker operations without Docker connection details"};
  }

  if (!context || !tag) {
    chatService.errorLine("[buildImage] context and tag are required");
    return {error: "context and tag are required"};
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

  // Construct the docker build command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 1800));
  let cmd = `timeout ${timeout}s ${dockerCmd} build`;

  // Add tag
  cmd += ` -t ${shellEscape(tag)}`;

  // Add dockerfile if specified
  if (dockerfile) {
    cmd += ` -f ${shellEscape(dockerfile)}`;
  }

  // Add build args
  for (const [key, value] of Object.entries(buildArgs)) {
    cmd += ` --build-arg ${shellEscape(`${key}=${value}`)}`;
  }

  // Add no-cache flag if specified
  if (noCache) {
    cmd += ` --no-cache`;
  }

  // Add pull flag if specified
  if (pull) {
    cmd += ` --pull`;
  }

  // Add context
  cmd += ` ${shellEscape(context)}`;

  chatService.infoLine(`[buildImage] Building image ${tag}...`);
  chatService.infoLine(`[buildImage] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 5 * 1024 * 1024,
    });
    chatService.systemLine(`[buildImage] Successfully built image ${tag}`);
    return {
      ok: true,
      exitCode: exitCode,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      tag: tag,
    };
  } catch (err: any) {
    chatService.errorLine(`[buildImage] Error: ${err.message}`);
    return {error: err.shortMessage || err.message};
  }
}

export const description = "Build a Docker image from a Dockerfile";

export const parameters = z.object({
  context: z
    .string()
    .describe("The build context (directory containing Dockerfile)"),
  tag: z.string().describe("The tag to apply to the built image"),
  dockerfile: z
    .string()
    .describe("Path to the Dockerfile (relative to context)")
    .optional(),
  buildArgs: z
    .record(z.string())
    .describe("Build arguments to pass to the build")
    .optional(),
  noCache: z
    .boolean()
    .describe("Whether to use cache when building the image")
    .default(false)
    .optional(),
  pull: z
    .boolean()
    .describe("Whether to always pull newer versions of the base images")
    .default(false)
    .optional(),
  timeoutSeconds: z
    .number()
    .int()
    .describe("Timeout in seconds")
    .default(300)
    .optional(),
});