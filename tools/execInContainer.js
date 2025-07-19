import { execa } from "execa";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * Execute a command in a running Docker container
 * @param {object} args
 * @param {string} args.container - Container name or ID
 * @param {string|string[]} args.command - Command to execute
 * @param {boolean} [args.interactive=false] - Whether to keep STDIN open even if not attached
 * @param {boolean} [args.tty=false] - Whether to allocate a pseudo-TTY
 * @param {string} [args.workdir] - Working directory inside the container
 * @param {Object} [args.env={}] - Environment variables to set
 * @param {boolean} [args.privileged=false] - Whether to give extended privileges to the command
 * @param {string} [args.user] - Username or UID to execute the command as
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the command execution
 */
export default execute;
export async function execute(
	{
		container,
		command,
		interactive = false,
		tty = false,
		workdir,
		env = {},
		privileged = false,
		user,
		timeoutSeconds = 30,
	},
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

	if (!container || !command) {
		chatService.errorLine(
			"[execInContainer] container and command are required",
		);
		return { error: "container and command are required" };
	}

	// Convert command to array if it's a string
	const commandList = Array.isArray(command) ? command : [command];
	if (commandList.length === 0) {
		chatService.errorLine("[execInContainer] command cannot be empty");
		return { error: "command cannot be empty" };
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

	// Construct the docker exec command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 300));
	let cmd = `timeout ${timeout}s ${dockerCmd} exec`;

	// Add interactive flag if specified
	if (interactive) {
		cmd += ` -i`;
	}

	// Add tty flag if specified
	if (tty) {
		cmd += ` -t`;
	}

	// Add workdir if specified
	if (workdir) {
		cmd += ` -w ${shellEscape(workdir)}`;
	}

	// Add environment variables
	for (const [key, value] of Object.entries(env)) {
		cmd += ` -e ${shellEscape(`${key}=${value}`)}`;
	}

	// Add privileged flag if specified
	if (privileged) {
		cmd += ` --privileged`;
	}

	// Add user if specified
	if (user) {
		cmd += ` -u ${shellEscape(user)}`;
	}

	// Add container
	cmd += ` ${shellEscape(container)}`;

	// Add command
	cmd += ` ${commandList.map((arg) => shellEscape(arg)).join(" ")}`;

	chatService.infoLine(
		`[execInContainer] Executing command in container ${container}...`,
	);
	chatService.infoLine(`[execInContainer] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 5 * 1024 * 1024,
		});

		chatService.systemLine(
			`[execInContainer] Command executed successfully in container ${container}`,
		);
		return {
			ok: true,
			exitCode: exitCode,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
			container: container,
			command: commandList.join(" "),
		};
	} catch (err) {
		chatService.errorLine(`[execInContainer] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.code === "number" ? err.code : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "Execute a command in a running Docker container";

export const parameters = z.object({
	container: z.string().describe("Container name or ID"),
	command: z
		.union([z.string(), z.array(z.string())])
		.describe("Command to execute"),
	interactive: z
		.boolean()
		.optional()
		.default(false)
		.describe("Whether to keep STDIN open even if not attached"),
	tty: z
		.boolean()
		.optional()
		.default(false)
		.describe("Whether to allocate a pseudo-TTY"),
	workdir: z
		.string()
		.optional()
		.describe("Working directory inside the container"),
	env: z
		.record(z.string())
		.optional()
		.default({})
		.describe("Environment variables to set"),
	privileged: z
		.boolean()
		.optional()
		.default(false)
		.describe("Whether to give extended privileges to the command"),
	user: z
		.string()
		.optional()
		.describe("Username or UID to execute the command as"),
	timeoutSeconds: z
		.number()
		.int()
		.optional()
		.default(30)
		.describe("Timeout in seconds"),
});
