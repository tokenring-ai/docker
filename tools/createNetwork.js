import { execa } from 'execa';
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * Create a Docker network
 * @param {object} args
 * @param {string} args.name - The name of the network
 * @param {string} [args.driver="bridge"] - Driver to manage the network
 * @param {Object} [args.options={}] - Driver specific options
 * @param {boolean} [args.internal=false] - Restrict external access to the network
 * @param {string} [args.subnet] - Subnet in CIDR format
 * @param {string} [args.gateway] - Gateway for the subnet
 * @param {string} [args.ipRange] - Allocate container IP from a sub-range
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the network creation
 */
export default execute;
export async function execute({
  name, 
  driver = "bridge", 
  options = {}, 
  internal = false, 
  subnet, 
  gateway, 
  ipRange, 
  timeoutSeconds = 30 
}, registry) {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);
  if (!dockerService) {
     chatService.errorLine((`[ERROR] DockerService not found, can't perform Docker operations without Docker connection details`));
    return "Couldn't perform Docker operation due to application misconfiguration, do not retry.";
  }

  if (!name) {
     chatService.errorLine(("[createNetwork] name is required"));
    return { error: "name is required" };
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
  cmd += ` ${shellEscape(name)}`;

   chatService.infoLine((`[createNetwork] Creating Docker network ${name}...`));
   chatService.infoLine((`[createNetwork] Executing: ${cmd}`));

  try {
    const { stdout, stderr, exitCode } = await execa(cmd, { shell: true, timeout: timeout * 1000, maxBuffer: 1024 * 1024 });

    // The output is the network ID
    const networkId = stdout.trim();

     chatService.systemLine((`[createNetwork] Successfully created Docker network ${name} (${networkId})`));
    return {
      ok: true,
      exitCode: exitCode,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      name: name,
      id: networkId
    };
  } catch (err) {
     chatService.errorLine((`[createNetwork] Error: ${err.message}`));
    return {
      ok: false,
      exitCode: (typeof err.code === "number") ? err.code : 1,
      stdout: err.stdout?.trim() || "",
      stderr: err.stderr?.trim() || "",
      error: err.shortMessage || err.message
    };
  }
}

export const description = "Create a Docker network";

export const parameters = z.object({
  name: z.string().describe("The name of the network"),
  driver: z.string().describe("Driver to manage the network").default("bridge"),
  options: z.record(z.string()).describe("Driver specific options").default({}),
  internal: z.boolean().describe("Restrict external access to the network").default(false),
  subnet: z.string().describe("Subnet in CIDR format").optional(),
  gateway: z.string().describe("Gateway for the subnet").optional(),
  ipRange: z.string().describe("Allocate container IP from a sub-range").optional(),
  timeoutSeconds: z.number().int().describe("Timeout in seconds").default(30)
});
