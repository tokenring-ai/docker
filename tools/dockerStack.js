import { execa } from "execa";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * Docker Stack management tool: deploy, update, remove Docker stacks in local Docker Swarm mode
 * @param {object} args
 * @param {string} args.action - The action to perform: "deploy", "remove", "ps"
 * @param {string} args.stackName - The stack name for Docker Swarm
 * @param {string} [args.composeFile] - Path to docker-compose.yml (required for deploy)
 * @param {number} [args.timeoutSeconds=60] - Timeout
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the shell command
 */
export default execute;
export async function execute(
	{ action, stackName, composeFile, timeoutSeconds = 60 },
	registry,
) {
	const chatService = registry.requireFirstServiceByType(ChatService);
	const dockerService = registry.requireFirstServiceByType(DockerService);
	if (!dockerService) {
		chatService.errorLine(
			`[ERROR] DockerService not found, can't perform Docker operations without Docker connection details`,
		);
		return "Couldn't perform Docker operation due to application misconfiguration, do not retry.";
	}

	if (!action || !stackName) {
		chatService.errorLine("[dockerStack] action and stackName are required");
		return { error: "action and stackName are required" };
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

	let cmd;
	const timeout = Math.max(5, Math.min(timeoutSeconds, 600));

	switch (action) {
		case "deploy":
			if (!composeFile) {
				chatService.errorLine("[dockerStack] composeFile required for deploy");
				return { error: "composeFile required for deploy" };
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
			chatService.errorLine(`[dockerStack] Unknown action: ${action}`);
			return { error: `Unknown action: ${action}` };
	}

	chatService.infoLine("[dockerStack] Executing: " + cmd);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
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
			error: null,
		};
	} catch (err) {
		chatService.errorLine(`[dockerStack] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.exitCode === "number" ? err.exitCode : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description =
	"Launch, update, or remove a Docker stack from the local Docker Swarm. Actions: deploy (requires composeFile), remove, ps.";

export const parameters = z.object({
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
