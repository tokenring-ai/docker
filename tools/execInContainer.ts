import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_execInContainer";
const displayName = "Docker/execInContainer";

/**
 * Execute a command in a running Docker container
 */

async function execute(
  { container, commands, interactive , tty , workdir, env,  privileged , user, timeoutSeconds  }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (commands.length === 0) {
    throw new Error(`[${name}] command cannot be empty`);
  }

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

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
  cmd += ` ${commands.map(arg => shellEscape(arg)).join(" ")}`;

  // Informational messages prefixed with tool name
  agent.infoMessage(`[execInContainer] Executing command in container ${container}...`);
  agent.infoMessage(`[execInContainer] Executing: ${cmd}`);

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 5 * 1024 * 1024,
    });

    agent.infoMessage(`[execInContainer] Command executed successfully in container ${container}`);
    return {
      summary: `Executed command in container ${container}`,
      result: JSON.stringify({ ok: true, exitCode, stdout: stdout?.trim() || "", stderr: stderr?.trim() || "", container, command: commands.join(" ") }),
    };
  } catch (err: any) {
    // Throw error instead of returning error object
    throw new Error(`[${name}] ${err.message}`);
  }
}

const description = "Execute a command in a running Docker container";

const inputSchema = z.object({
  container: z.string().describe("Container name or ID"),
  commands: z.array(z.string()).describe("Commands to execute"),
  interactive: z.boolean().exactOptional().default(false).describe("Whether to keep STDIN open even if not attached"),
  tty: z.boolean().exactOptional().default(false).describe("Whether to allocate a pseudo-TTY"),
  workdir: z.string().exactOptional().describe("Working directory inside the container"),
  env: z.record(z.string(), z.string()).exactOptional().default({}).describe("Environment variables to set"),
  privileged: z.boolean().exactOptional().default(false).describe("Whether to give extended privileges to the command"),
  user: z.string().exactOptional().describe("Username or UID to execute the command as"),
  timeoutSeconds: z.number().default(120).default(30).describe("Timeout in seconds"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
