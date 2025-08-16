import ChatService from "@token-ring/chat/ChatService";
import { Registry } from "@token-ring/registry";
import { shellEscape } from "@token-ring/utility/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { DockerCommandResult } from "../types.ts";

export const name = "docker/authenticateRegistry";

interface AuthenticateRegistryArgs {
  server: string;
  username: string;
  password: string;
  email?: string;
  passwordStdin?: boolean;
  timeoutSeconds?: number;
}

interface AuthResult extends DockerCommandResult {
  server?: string;
  username?: string;
}

/**
 * Authenticate against a Docker registry
 * @param args - Authentication parameters
 * @param registry - The package registry
 * @returns Result of the login operation
 */
export async function execute(
  {
    server,
    username,
    password,
    email,
    passwordStdin = false,
    timeoutSeconds = 30,
  }: AuthenticateRegistryArgs,
  registry: Registry
): Promise<AuthResult> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);

  if (!dockerService) {
    // Informational message follows the required format
    chatService.errorLine(
      `[${name}] DockerService not found, can't perform Docker operations without Docker connection details`
    );
    throw new Error(
      `[${name}] DockerService not found, cannot perform Docker operations`
    );
  }

  if (!server || !username || (!password && !passwordStdin)) {
    chatService.errorLine(
      `[${name}] server, username, and password are required`
    );
    throw new Error(
      `[${name}] server, username, and password are required`
    );
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

  chatService.infoLine(
    `[${name}] Authenticating to registry ${server}...`
  );
  // Don't log the full command as it may contain sensitive information
  chatService.infoLine(
    `[${name}] Executing: ${dockerCmd} login ${server} -u ${username} [password hidden]`
  );

  const execOptions: { maxBuffer: number; input?: string } = { maxBuffer: 1024 * 1024 };

  // If using passwordStdin, we need to provide the password via stdin
  if (passwordStdin) {
    execOptions.input = password;
  }

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      ...execOptions,
      timeout: timeout * 1000,
    });
    chatService.systemLine(
      `[${name}] Successfully authenticated to registry ${server}`
    );
    return {
      ok: true,
      exitCode: exitCode,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      server: server,
      username: username,
    };
  } catch (err: any) {
    // Error message follows the required format
    chatService.errorLine(`[${name}] Error: ${err.message}`);
    throw new Error(`[${name}] ${err.shortMessage || err.message}`);
  }
}

export const description = "Authenticate against a Docker registry";
export const parameters = z.object({
  server: z
    .string()
    .describe("The registry server URL (e.g., 'https://index.docker.io/v1/')"),
  username: z.string().describe("Username for the registry"),
  password: z.string().describe("Password for the registry"),
  email: z.string().describe("Email for the registry account").optional(),
  passwordStdin: z
    .boolean()
    .describe("Take the password from stdin")
    .default(false)
    .optional(),
  timeoutSeconds: z
    .number()
    .int()
    .describe("Timeout in seconds")
    .default(30)
    .optional(),
});