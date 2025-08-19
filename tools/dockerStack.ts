import ChatService from "@token-ring/chat/ChatService";
import {Registry} from "@token-ring/registry";
import {shellEscape} from "@token-ring/utility/shellEscape";
import {execa} from "execa";
import {z} from "zod";
import DockerService from "../DockerService.ts";
import {DockerCommandResult} from "../types.ts";

type StackAction = "deploy" | "remove" | "ps";

interface DockerStackArgs {
  action: StackAction;
  stackName: string;
  composeFile?: string;
  timeoutSeconds?: number;
}

/**
 * Docker Stack management tool: deploy, update, remove Docker stacks in local Docker Swarm mode
 */

export const name = "docker/dockerStack";

export async function execute(
  {action, stackName, composeFile, timeoutSeconds = 60}: DockerStackArgs,
  registry: Registry
): Promise<DockerCommandResult> {
  const chatService = registry.requireFirstServiceByType(ChatService);
  const dockerService = registry.requireFirstServiceByType(DockerService);

  if (!dockerService) {
    throw new Error(`[${name}] DockerService not found, can't perform Docker operations without Docker connection details`);
  }

  if (!action || !stackName) {
    throw new Error(`[${name}] action and stackName are required`);
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

  let cmd: string;
  const timeout = Math.max(5, Math.min(timeoutSeconds, 600));

  switch (action) {
    case "deploy":
      if (!composeFile) {
        throw new Error(`[${name}] composeFile required for deploy`);
      }
      cmd = `timeout ${timeout}s ${dockerCmd} stack deploy -c ${shellEscape(composeFile)} ${shellEscape(stackName)}`;
      break;
    case "remove":
      cmd = `timeout ${timeout}s ${dockerCmd} stack rm ${shellEscape(stackName)}`;
      break;
    case "ps":
      cmd = `timeout ${timeout}s ${dockerCmd} stack ps ${shellEscape(stackName)}`;
      break;
    default:
      throw new Error(`[${name}] Unknown action: ${action}`);
  }

  chatService.infoLine(`[dockerStack] Executing: ${cmd}`);

  try {
    const {stdout, stderr, exitCode} = await execa(cmd, {
      shell: true,
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
    });
    chatService.systemLine(
      `[dockerStack] Successfully executed ${action} on stack ${stackName}`,
    );
    return {
      ok: true,
      exitCode: exitCode,
      stdout: stdout?.trim() || "",
      stderr: stderr?.trim() || "",
      error: undefined,
    };
  } catch (err: any) {
    // Propagate as an error with contextual information
    throw new Error(`[${name}] ${err.message}`);
  }
}

export const description =
  "Launch, update, or remove a Docker stack from the local Docker Swarm. Actions: deploy (requires composeFile), remove, ps.";

export const inputSchema = z.object({
  action: z
    .enum(["deploy", "remove", "ps"])
    .describe("Action to perform: 'deploy', 'remove', or 'ps'."),
  stackName: z.string().describe("Name of the stack to deploy/remove/list."),
  composeFile: z
    .string()
    .describe("Path to docker-compose.yml file (required for deploy)")
    .optional(),
  timeoutSeconds: z
    .number()
    .int()
    .describe("Timeout for the stack operation in seconds (default: 60).")
    .optional(),
});