import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import DockerService from "../DockerService.ts";
import { clampTimeout, executeDockerCommand } from "../util/executeDockerCommand.ts";

const name = "docker_buildImage";
const displayName = "Docker/buildImage";

/**
 * Build a Docker image
 */
async function execute(
  { context, tag, dockerfile, buildArgs, noCache, pull, timeoutSeconds }: z.output<typeof inputSchema>,
  agent: Agent,
): Promise<TokenRingToolResult> {
  const dockerService = agent.requireServiceByType(DockerService);
  const timeout = clampTimeout(timeoutSeconds, 5, 1800);
  const dockerArgs = ["build", "-t", tag];

  if (dockerfile) {
    dockerArgs.push("-f", dockerfile);
  }

  for (const [key, value] of Object.entries(buildArgs)) {
    dockerArgs.push("--build-arg", `${key}=${value}`);
  }

  if (noCache) {
    dockerArgs.push("--no-cache");
  }

  if (pull) {
    dockerArgs.push("--pull");
  }

  dockerArgs.push(context);

  return await executeDockerCommand(dockerService, agent, {
    toolName: name,
    message: `**Docker Image* Built image ${tag}`,
    resultLabel: `Built Docker image ${tag}`,
    dockerArgs,
    timeoutSeconds: timeout,
    maxTimeout: 1800,
    contextLines: [`Tag: ${tag}`, `Context: ${context}`],
    errorMessage: "Error while building image",
  });
}

const description = "Build a Docker image from a Dockerfile";

const inputSchema = z.object({
  context: z.string().describe("The build context (directory containing Dockerfile)"),
  tag: z.string().describe("The tag to apply to the built image"),
  dockerfile: z.string().describe("Path to the Dockerfile (relative to context)").exactOptional(),
  buildArgs: z.record(z.string(), z.string()).default({}).describe("Build arguments to pass to the build"),
  noCache: z.boolean().describe("Whether to use cache when building the image").default(false),
  pull: z.boolean().describe("Whether to always pull newer versions of the base images").default(false),
  timeoutSeconds: z.number().default(120).describe("Timeout in seconds").default(300),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
