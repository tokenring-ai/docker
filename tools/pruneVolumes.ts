import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/types";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

// Export the tool name in the required format
const name = "docker/pruneVolumes";

interface PruneVolumesResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  spaceReclaimed: string;
  volumesDeleted: number;
}

/**
 * Prune unused Docker volumes
 */
async function execute(
  {
    filter,
    timeoutSeconds = 60,
  }: z.infer<typeof inputSchema>,
  agent: Agent,
): Promise<PruneVolumesResult> {
  const dockerService = agent.requireServiceByType(DockerService);

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

  // Construct the docker volume prune command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 300));
  let cmd = `timeout ${timeout}s ${dockerCmd} volume prune -f`; // Always use -f to avoid interactive prompt

  // Add filter if specified
  if (filter) {
    cmd += ` --filter ${shellEscape(filter)}`;
  }

  agent.infoLine(`[${name}] Pruning unused Docker volumes...`);
  agent.infoLine(`[${name}] Executing: ${cmd}`);

  const {stdout, stderr, exitCode} = await execa(cmd, {
    shell: true,
    timeout: timeout * 1000,
    maxBuffer: 1024 * 1024,
  });

  // Parse the output to extract the amount of space reclaimed
  let spaceReclaimed = "0B";
  const match = stdout.match(/Total reclaimed space: ([\d\.]+\s?[KMGT]?B)/i);
  if (match) {
    spaceReclaimed = match[1];
  }

  // Parse the output to extract the number of volumes deleted
  let volumesDeleted = 0;
  const deletedMatch = stdout.match(/Deleted Volumes:\s*([^]*?)Total/);
  if (deletedMatch) {
    const deletedText = deletedMatch[1].trim();
    volumesDeleted = deletedText
      .split("\n")
      .filter((line) => line.trim()).length;
  }

  agent.infoLine(
    `[${name}] Successfully pruned unused Docker volumes. Space reclaimed: ${spaceReclaimed}`,
  );
  return {
    ok: true,
    exitCode: exitCode ?? 0,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    spaceReclaimed: spaceReclaimed,
    volumesDeleted: volumesDeleted,
  };
}

const description = "Prune unused Docker volumes";

const inputSchema = z.object({
  filter: z
    .string()
    .describe("Filter volumes based on conditions provided")
    .optional(),
  force: z
    .boolean()
    .describe("Whether to force removal of volumes")
    .default(false),
  timeoutSeconds: z.number().int().describe("Timeout in seconds").default(60),
});

export default {
  name, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;