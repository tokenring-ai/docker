import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

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
  const timeout = clampTimeout(timeoutSeconds, 5, 120);
  const dockerArgs = ["network", "create"];

  if (driver !== "bridge") {
    dockerArgs.push("-d", driver);
  }

  for (const [key, value] of Object.entries(options)) {
    dockerArgs.push("-o", `${key}=${value}`);
  }

  if (internal) {
    dockerArgs.push("--internal");
  }

  if (subnet) {
    dockerArgs.push(`--subnet=${subnet}`);
  }

  if (gateway) {
    dockerArgs.push(`--gateway=${gateway}`);
  }

  if (ipRange) {
    dockerArgs.push(`--ip-range=${ipRange}`);
  }

  dockerArgs.push(networkName);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Network** Created network "${networkName}"`,
    resultLabel: `Created Docker network "${networkName}"`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 120,
    contextLines: [`Driver: ${driver}`],
    errorMessage: `Error while creating Docker network "${networkName}"`,
  });
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
