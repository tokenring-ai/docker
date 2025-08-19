import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

export const name = "docker/createNetwork";

interface CreateNetworkArgs {
  name: string;
  driver?: string;
  options?: Record<string, string>;
  internal?: boolean;
  subnet?: string;
  gateway?: string;
  ipRange?: string;
  timeoutSeconds?: number;
}

interface CreateNetworkResult extends DockerCommandResult {
  name?: string;
  id?: string;
}

/**
 * Create a Docker network
 */
export async function execute(
  {
    name: networkName,
    driver = "bridge",
    options = {},
    internal = false,
    subnet,
    gateway,
    ipRange,
    timeoutSeconds = 30,
  }: CreateNetworkArgs,
  registry: Registry
): Promise<CreateNetworkResult> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
    const errMsg =
      "DockerService not found, can't perform Docker operations without Docker connection details";
    // Removed chatService.errorLine per specification
    throw new Error(`[${name}] ${errMsg}`);
  }

  if (!networkName) {
    const errMsg = "name is required";
    // Removed chatService.errorLine per specification
    throw new Error(`[${name}] ${errMsg}`);
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

  // Construct the docker network create command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} network create`;

  // Add driver if specified
  if (driver !== "bridge") {
    cmd += ` -d ${shellEscape(driver)}`;
  }

  // Add options if specified
  for (const [key, value] of Object.entries(options)) {
    cmd += ` -o ${shellEscape(`${key}=${value}`)}`;
  }

  // Add internal flag if specified
  if (internal) {
    cmd += ` --internal`;
  }

  // Add subnet if specified
  if (subnet) {
    cmd += ` --subnet=${shellEscape(subnet)}`;
  }

  // Add gateway if specified
  if (gateway) {
    cmd += ` --gateway=${shellEscape(gateway)}`;
  }

  // Add IP range if specified
  if (ipRange) {
    cmd += ` --ip-range=${shellEscape(ipRange)}`;
  }

  // Add network name
  cmd += ` ${shellEscape(networkName)}`;

  chatService.infoLine(`[${name}] Creating Docker network ${networkName}...`);
  chatService.infoLine(`[${name}] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    // The output is the network ID
    const networkId = stdout.trim();

    chatService.systemLine(
      `[${name}] Successfully created Docker network ${networkName} (${networkId})`
    );
    return {
      ok: true,
      exitCode: exitCode,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      name: networkName,
      id: networkId,
    };
  } catch (err: any) {
    const errMsg = err.message || "Unknown error";
    // Removed chatService.errorLine per specification
    throw new Error(`[${name}] ${errMsg}`);
  }
}

export const description = "Create a Docker network";

export const inputSchema = z.object({
  name: z.string().describe("The name of the network"),
  driver: z.string().describe("Driver to manage the network").default("bridge"),
  options: z.record(z.string()).describe("Driver specific options").default({}),
  internal: z
    .boolean()
    .describe("Restrict external access to the network")
    .default(false),
  subnet: z.string().describe("Subnet in CIDR format").optional(),
  gateway: z.string().describe("Gateway for the subnet").optional(),
  ipRange: z
    .string()
    .describe("Allocate container IP from a sub-range")
    .optional(),
  timeoutSeconds: z.number().int().describe("Timeout in seconds").default(30),
});