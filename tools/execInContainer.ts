import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/types";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

const name = "docker_execInContainer";

interface ExecInContainerResult extends DockerCommandResult {
  container?: string;
  command?: string;
}

/**
 * Execute a command in a running Docker container
 */

async function execute(
  {
    container,
    command,
    interactive = false,
    tty = false,
    workdir,
    env = {},
    privileged = false,
    user,
    timeoutSeconds = 30,
  }: z.infer<typeof inputSchema>,
  agent: Agent
): Promise<ExecInContainerResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (!container || !command) {
    throw new Error(`[${name}] container and command are required`);
  }

  // Convert command to array if it's a string
  const commandList = Array.isArray(command) ? command : [command];
  if (commandList.length === 0) {
    throw new Error(`[${name}] command cannot be empty`);
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

  // Construct the docker exec command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 300));
  let cmd = `timeout ${timeout}s ${dockerCmd} exec`;

  // Add interactive flag if specified
  if (interactive) {
    cmd += ` -i`;
  }

  // Add tty flag if specified
  if (tty) {
    cmd += ` -t`;
  }

  // Add workdir if specified
  if (workdir) {
    cmd += ` -w ${shellEscape(workdir)}`;
  }

  // Add environment variables
  for (const [key, value] of Object.entries(env)) {
    cmd += ` -e ${shellEscape(`${key}=${value}`)}`;
  }

  // Add privileged flag if specified
  if (privileged) {
    cmd += ` --privileged`;
  }

  // Add user if specified
  if (user) {
    cmd += ` -u ${shellEscape(user)}`;
  }

  // Add container
  cmd += ` ${shellEscape(container)}`;

  // Add command
  cmd += ` ${commandList.map((arg) => shellEscape(arg)).join(" ")}`;

  // Informational messages prefixed with tool name
  agent.infoLine(
    `[execInContainer] Executing command in container ${container}...`,
  );
  agent.infoLine(`[execInContainer] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 5 * 1024 * 1024,
    });

    agent.infoLine(
      `[execInContainer] Command executed successfully in container ${container}`,
    );
    return {
      ok: true,
      exitCode: exitCode,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      container: container,
      command: commandList.join(" "),
    };
  } catch (err: any) {
    // Throw error instead of returning error object
    throw new Error(`[${name}] ${err.message}`);
  }
}

const description = "Execute a command in a running Docker container";

const inputSchema = z.object({
  container: z.string().describe("Container name or ID"),
  command: z
    .union([z.string(), z.array(z.string())])
    .describe("Command to execute"),
  interactive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to keep STDIN open even if not attached"),
  tty: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to allocate a pseudo-TTY"),
  workdir: z
    .string()
    .optional()
    .describe("Working directory inside the container"),
  env: z
    .record(z.string(), z.string())
    .optional()
    .default({})
    .describe("Environment variables to set"),
  privileged: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to give extended privileges to the command"),
  user: z
    .string()
    .optional()
    .describe("Username or UID to execute the command as"),
  timeoutSeconds: z
    .number()
    .int()
    .optional()
    .default(30)
    .describe("Timeout in seconds"),
});

export default {
  name, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;