import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/types";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

// Export tool name for consistent messaging
const name = "docker/startContainer";

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
async function execute(
  {
    containers,
    attach = false,
    interactive = false,
    timeoutSeconds = 30,
  }: z.infer<typeof inputSchema>,
  agent: Agent,
): Promise<StartContainerResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (!containers) {
    throw new Error(`[${name}] containers is required`);
  }

  // Convert single container to array (maintained for backward compatibility)
  const containerList = Array.isArray(containers) ? containers : [containers];
  if (containerList.length === 0) {
    throw new Error(`[${name}] at least one container must be specified`);
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

  agent.infoLine(
    `[${name}] Starting container(s): ${containerList.join(", ")}...`,
  );
  agent.infoLine(`[${name}] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  agent.infoLine(
    `[${name}] Successfully started container(s): ${containerList.join(", ")}`,
  );
  return {
    ok: true,
    exitCode: exitCode,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    containers: containerList,
  };
}

const description = "Start one or more Docker containers";

const inputSchema = z
  .object({
    containers: z.union([z.string(), z.array(z.string())]).describe(
      "Container ID(s) or name(s) to start",
    ),
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

export default {
  name, description, inputSchema, execute,
} as TokenRingToolDefinition<typeof inputSchema>;