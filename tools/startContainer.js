import { execa } from "execa";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * Start one or more Docker containers
 * @param {object} args
 * @param {string|string[]} args.containers - Container ID(s) or name(s) to start
 * @param {boolean} [args.attach=false] - Whether to attach STDOUT/STDERR and forward signals
 * @param {boolean} [args.interactive=false] - Whether to attach container's STDIN
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the start operation
 */
export default execute;
export async function execute(
	{ containers, attach = false, interactive = false, timeoutSeconds = 30 },
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

	if (!containers) {
		chatService.errorLine("[startContainer] containers is required");
		return { error: "containers is required" };
	}

	// Convert single container to array
	const containerList = Array.isArray(containers) ? containers : [containers];
	if (containerList.length === 0) {
		chatService.errorLine(
			"[startContainer] at least one container must be specified",
		);
		return { error: "at least one container must be specified" };
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

	// Construct the docker start command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
	let cmd = `timeout ${timeout}s ${dockerCmd} start`;

	// Add attach flag if specified
	if (attach) {
		cmd += ` -a`;
	}

	// Add interactive flag if specified
	if (interactive) {
		cmd += ` -i`;
	}

	// Add containers
	cmd += ` ${containerList.map((container) => shellEscape(container)).join(" ")}`;

	chatService.infoLine(
		`[startContainer] Starting container(s): ${containerList.join(", ")}...`,
	);
	chatService.infoLine(`[startContainer] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 1024 * 1024,
		});

		chatService.systemLine(
			`[startContainer] Successfully started container(s): ${containerList.join(", ")}`,
		);
		return {
			ok: true,
			exitCode: exitCode,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
			containers: containerList,
		};
	} catch (err) {
		chatService.errorLine(`[startContainer] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.code === "number" ? err.code : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "Start one or more Docker containers";

export const parameters = z
	.object({
		containers: z.union([z.string(), z.array(z.string())], {
			description: "Container ID(s) or name(s) to start",
		}),
		attach: z
			.boolean()
			.optional()
			.default(false)
			.describe("Whether to attach STDOUT/STDERR and forward signals"),
		interactive: z
			.boolean()
			.optional()
			.default(false)
			.describe("Whether to attach container's STDIN"),
		timeoutSeconds: z
			.number()
			.int()
			.optional()
			.default(30)
			.describe("Timeout in seconds"),
	})
	.strict();
