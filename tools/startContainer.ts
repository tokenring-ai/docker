import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";


interface StartContainerResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  containers: string[];
}

/**
 * Start one or more Docker containers
 */
export async function execute(
  {containers, attach = false, interactive = false, timeoutSeconds = 30}: {
    containers: string[];
    attach: boolean;
    interactive: boolean;
    timeoutSeconds: number
  },
  registry: Registry,
): Promise<StartContainerResult | { error: string }> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    // Informational error message prefixed with tool name
    chatService.errorLine(
      `[startContainer] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return {error: "DockerService not found, can't perform Docker operations without Docker connection details"};
  }

  if (!containers) {
    chatService.errorLine("[startContainer] containers is required");
    return {error: "containers is required"};
  }

  // Convert single container to array
  const containerList = Array.isArray(containers) ? containers : [containers];
  if (containerList.length === 0) {
    chatService.errorLine(
      "[startContainer] at least one container must be specified",
    );
    return {error: "at least one container must be specified"};
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

  // Construct the docker start command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} start`;

  // Add attach flag if specified
  if (attach) {
    cmd += ` -a`;
  }

  // Add interactive flag if specified
  if (interactive) {
    cmd += ` -i`;
  }

  // Add containers
  cmd += ` ${containerList.map((container) => shellEscape(container)).join(" ")}`;

  chatService.infoLine(
    `[startContainer] Starting container(s): ${containerList.join(", ")}...`,
  );
  chatService.infoLine(`[startContainer] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  chatService.systemLine(
    `[startContainer] Successfully started container(s): ${containerList.join(", ")}`,
  );
  return {
    ok: true,
    exitCode: exitCode,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    containers: containerList,
  };

}

export const description = "Start one or more Docker containers";

export const parameters = z
  .object({
    containers: z.union([z.string(), z.array(z.string())], {
      description: "Container ID(s) or name(s) to start",
    }),
    attach: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to attach STDOUT/STDERR and forward signals"),
    interactive: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to attach container's STDIN"),
    timeoutSeconds: z
      .number()
      .int()
      .optional()
      .default(30)
      .describe("Timeout in seconds"),
  })
  .strict();
