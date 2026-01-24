import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

const name = "docker_createNetwork";
const displayName = "Docker/createNetwork";

interface CreateNetworkResult extends DockerCommandResult {
  name?: string;
  id?: string;
}

/**
 * Create a Docker network
 */
async function execute(
  {
    name: networkName,
    driver = "bridge",
    options = {},
    internal = false,
    subnet,
    gateway,
    ipRange,
    timeoutSeconds = 30,
  }: z.infer<typeof inputSchema>,
  agent: Agent
): Promise<CreateNetworkResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  if (!networkName) {
    const errMsg = "name is required";
    // Removed agent.errorMessage per specification
    throw new Error(`[${name}] ${errMsg}`);
  }

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

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

  agent.infoMessage(`[${name}] Creating Docker network ${networkName}...`);
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    // The output is the network ID
    const networkId = stdout.trim();

    agent.infoMessage(
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
    // Removed agent.errorMessage per specification
    throw new Error(`[${name}] ${errMsg}`);
  }
}

const description = "Create a Docker network";

const inputSchema = z.object({
  name: z.string().describe("The name of the network"),
  driver: z.string().describe("Driver to manage the network").default("bridge"),
  options: z.record(z.string(), z.string()).describe("Driver specific options").default({}),
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

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;