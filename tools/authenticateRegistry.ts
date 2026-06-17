import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_authenticateRegistry";
const displayName = "Docker/authenticateRegistry";

/**
 * Authenticate against a Docker registry
 */
async function execute(
  { server, username, password, email, passwordStdin , timeoutSeconds  }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker login command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} login`;

  // Add server
  cmd += ` ${shellEscape(server)}`;

  // Add username
  cmd += ` -u ${shellEscape(username)}`;

  // Add password if not using stdin
  if (!passwordStdin) {
    cmd += ` -p ${shellEscape(password)}`;
  }

  // Add email if specified
  if (email) {
    cmd += ` --email ${shellEscape(email)}`;
  }

  agent.infoMessage(`[${name}] Authenticating to registry ${server}...`);
  // Don't log the full command as it may contain sensitive information
  agent.infoMessage(`[${name}] Executing: ${dockerCmd} login ${server} -u ${username} [password hidden]`);

  const execOptions: { maxBuffer: number; input?: string | undefined } = {
    maxBuffer: 1024 * 1024,
  };

  // If using passwordStdin, we need to provide the password via stdin
  if (passwordStdin) {
    execOptions.input = password;
  }

  try {
    const { stdout, stderr, exitCode } = await execa(
      cmd,
      stripUndefinedKeys({
        shell: true,
        ...execOptions,
        timeout: timeout * 1000,
      }),
    );
    agent.infoMessage(`[${name}] Successfully authenticated to registry ${server}`);
    return {
      summary: `Authenticated to Docker registry ${server} as ${username}`,
      result: JSON.stringify({ ok: true, exitCode, stdout: stdout?.trim() || "", stderr: stderr?.trim() || "", server, username }),
    };
  } catch (err: any) {
    // Error message follows the required format
    agent.errorMessage(`[${name}] Error: ${err.message}`);
    throw new Error(`[${name}] ${err.shortMessage || err.message}`);
  }
}

const description = "Authenticate against a Docker registry";

const inputSchema = z.object({
  server: z.string().describe("The registry server URL (e.g., 'https://index.docker.io/v1/')"),
  username: z.string().describe("Username for the registry"),
  password: z.string().describe("Password for the registry"),
  email: z.string().describe("Email for the registry account").exactOptional(),
  passwordStdin: z.boolean().describe("Take the password from stdin").default(false),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(30),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
