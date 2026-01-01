import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

const name = "docker_pruneImages";

interface PruneImagesResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  spaceReclaimed: string;
}

/**
 * Prune unused Docker images
 */
async function execute(
  {all = false, filter, timeoutSeconds = 60}: z.infer<typeof inputSchema>,
  agent: Agent,
): Promise<PruneImagesResult> {
  const dockerService = agent.requireServiceByType(DockerService);

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker image prune command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 300));
  let cmd = `timeout ${timeout}s ${dockerCmd} image prune -f`; // Always use -f to avoid interactive prompt

  // Add all flag if specified
  if (all) {
    cmd += ` -a`;
  }

  // Add filter if specified
  if (filter) {
    cmd += ` --filter ${shellEscape(filter)}`;
  }

  agent.infoLine(`[${name}] Pruning unused Docker images...`);
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

  agent.infoLine(
    `[${name}] Successfully pruned unused Docker images. Space reclaimed: ${spaceReclaimed}`,
  );

  return {
    ok: true,
    exitCode: exitCode ?? 0,
    stdout: stdout?.trim() || "",
    stderr: stderr?.trim() || "",
    spaceReclaimed: spaceReclaimed,
  };
}

const description = "Prune unused Docker images";

const inputSchema = z.object({
  all: z
    .boolean()
    .default(false)
    .describe("Whether to remove all unused images, not just dangling ones"),
  filter: z.string().optional().describe("Filter images based on conditions provided"),
  force: z.boolean().default(false).describe("Whether to force removal of images"),
  timeoutSeconds: z.number().int().default(60).describe("Timeout in seconds"),
});

export default {
  name, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
