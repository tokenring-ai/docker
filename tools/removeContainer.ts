import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";

/**
 * Remove one or more Docker containers
 */

const name = "docker_removeContainer";
const displayName = "Docker/removeContainer";

async function execute(
  {
    containers,
    force = false,
    volumes = false,
    link = false,
    timeoutSeconds = 30,
  }: z.infer<typeof inputSchema>,
  agent: Agent,
) {
  const dockerService = agent.requireServiceByType(DockerService);


  if (!containers) {
    throw new Error(`[${name}] containers is required`);
  }

  // Convert single container to array
  const containerList = Array.isArray(containers) ? containers : [containers];
  if (containerList.length === 0) {
    throw new Error(`[${name}] at least one container must be specified`);
  }

  // Build Docker command with host and TLS settings
  const dockerCmd = dockerService.buildDockerCmd();

  // Construct the docker rm command
  const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
  let cmd = `timeout ${timeout}s ${dockerCmd} rm`;

  // Add force flag if specified
  if (force) {
    cmd += ` -f`;
  }

  // Add volumes flag if specified
  if (volumes) {
    cmd += ` -v`;
  }

  // Add link flag if specified
  if (link) {
    cmd += ` -l`;
  }

  // Add containers
  cmd += ` ${containerList.map((container) => shellEscape(container)).join(" ")}`;

  agent.infoMessage(
    `[${name}] Removing container(s): ${containerList.join(", ")}...`,
  );
  agent.infoMessage(`[${name}] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });

    agent.infoMessage(
      `[${name}] Successfully removed container(s): ${containerList.join(", ")}`,
    );
    return {
      ok: true,
      exitCode: exitCode,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      containers: containerList,
    };
  } catch (err: any) {
    // Throw error instead of returning an error object
    throw new Error(`[${name}] ${err.message}`);
  }
}

const description = "Remove one or more Docker containers";

const inputSchema = z.object({
  containers: z
    .union([z.string(), z.array(z.string())])
    .describe("Container ID(s) or name(s) to remove"),
  force: z.boolean().default(false).describe("Whether to force the removal of a running container"),
  volumes: z.boolean().default(false).describe("Whether to remove anonymous volumes associated with the container"),
  link: z.boolean().default(false).describe("Whether to remove the specified link"),
  timeoutSeconds: z.number().int().default(30).describe("Timeout in seconds"),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
