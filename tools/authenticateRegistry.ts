import {execa} from "execa";
import {shellEscape} from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import {z} from "zod";
import {DockerCommandResult} from "../types.ts";
import {Registry} from "@token-ring/registry";

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
): Promise<AuthResult | string> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    chatService.errorLine(
      `[ERROR] DockerService not found, can't perform Docker operations without Docker connection details`,
    );
    return "Couldn't perform Docker operation due to application misconfiguration, do not retry.";
  }

  if (!server || !username || (!password && !passwordStdin)) {
    chatService.errorLine(
      "[authenticateRegistry] server, username, and password are required",
    );
    return { error: "server, username, and password are required" };
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
    `[authenticateRegistry] Authenticating to registry ${server}...`,
  );
  // Don't log the full command as it may contain sensitive information
  chatService.infoLine(
    `[authenticateRegistry] Executing: ${dockerCmd} login ${server} -u ${username} [password hidden]`,
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
      `[authenticateRegistry] Successfully authenticated to registry ${server}`,
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
    chatService.errorLine(`[authenticateRegistry] Error: ${err.message}`);
    return {
      ok: false,
      exitCode: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout?.trim() || "",
      stderr: err.stderr?.trim() || "",
      error: err.shortMessage || err.message,
    };
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