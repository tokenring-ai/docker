import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import { execa } from "execa";
import { z } from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_createNetwork";
const displayName = "Docker/createNetwork";

/**
 * Create a Docker network
 */
async function execute(
  { name: networkName, driver, options, internal, subnet, gateway, ipRange, timeoutSeconds }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);

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
    const { stdout, stderr, exitCode } = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    // The output is the network ID
    const networkId = stdout.trim();

    agent.infoMessage(`[${name}] Successfully created Docker network ${networkName} (${networkId})`);
    return {
      summary: `Created Docker network "${networkName}" (ID: ${networkId})`,
      result: JSON.stringify({ ok: true, exitCode, stdout: stdout.trim() || "", stderr: stderr.trim() || "", name: networkName, id: networkId }),
    };
  } catch (err) {
    throw new ToolCallError(name, `Error while creating Docker network "${networkName}"`, { cause: err });
  }
}

const description = "Create a Docker network";

const inputSchema = z.object({
  name: z.string().describe("The name of the network"),
  driver: z.string().describe("Driver to manage the network").default("bridge"),
  options: z.record(z.string(), z.string()).describe("Driver specific options").default({}),
  internal: z.boolean().describe("Restrict external access to the network").default(false),
  subnet: z.string().describe("Subnet in CIDR format").exactOptional(),
  gateway: z.string().describe("Gateway for the subnet").exactOptional(),
  ipRange: z.string().describe("Allocate container IP from a sub-range").exactOptional(),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(30),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
