import { execa } from "execa";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * Stop one or more Docker containers
 * @param {object} args
 * @param {string|string[]} args.containers - Container ID(s) or name(s) to stop
 * @param {number} [args.time=10] - Seconds to wait for stop before killing the container
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the stop operation
 */
export default execute;
export async function execute(
	{ containers, time = 10, timeoutSeconds = 30 },
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
		chatService.errorLine("[stopContainer] containers is required");
		return { error: "containers is required" };
	}

	// Convert single container to array
	const containerList = Array.isArray(containers) ? containers : [containers];
	if (containerList.length === 0) {
		chatService.errorLine(
			"[stopContainer] at least one container must be specified",
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

	// Construct the docker stop command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
	let cmd = `timeout ${timeout}s ${dockerCmd} stop`;

	// Add time parameter if specified
	if (time !== 10) {
		// Only add if different from default
		cmd += ` -t ${shellEscape(String(time))}`;
	}

	// Add containers
	cmd += ` ${containerList.map((container) => shellEscape(container)).join(" ")}`;

	chatService.infoLine(
		`[stopContainer] Stopping container(s): ${containerList.join(", ")}...`,
	);
	chatService.infoLine(`[stopContainer] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 1024 * 1024,
		});

		chatService.systemLine(
			`[stopContainer] Successfully stopped container(s): ${containerList.join(", ")}`,
		);
		return {
			ok: true,
			exitCode: exitCode,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
			containers: containerList,
		};
	} catch (err) {
		chatService.errorLine(`[stopContainer] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.code === "number" ? err.code : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "Stop one or more Docker containers";

export const parameters = z.object({
	containers: z
		.union([z.string(), z.array(z.string())], {
			required_error: "containers is required",
			invalid_type_error: "containers must be a string or array of strings",
		})
		.describe("Container ID(s) or name(s) to stop"),
	time: z
		.number()
		.int()
		.default(10)
		.describe("Seconds to wait for stop before killing the container"),
	timeoutSeconds: z.number().int().default(30).describe("Timeout in seconds"),
});
