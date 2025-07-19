import { execa } from "execa";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * Remove one or more Docker containers
 * @param {object} args
 * @param {string|string[]} args.containers - Container ID(s) or name(s) to remove
 * @param {boolean} [args.force=false] - Whether to force the removal of a running container
 * @param {boolean} [args.volumes=false] - Whether to remove anonymous volumes associated with the container
 * @param {boolean} [args.link=false] - Whether to remove the specified link
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the remove operation
 */
export default execute;
export async function execute(
	{
		containers,
		force = false,
		volumes = false,
		link = false,
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

	if (!containers) {
		chatService.errorLine("[removeContainer] containers is required");
		return { error: "containers is required" };
	}

	// Convert single container to array
	const containerList = Array.isArray(containers) ? containers : [containers];
	if (containerList.length === 0) {
		chatService.errorLine(
			"[removeContainer] at least one container must be specified",
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

	chatService.infoLine(
		`[removeContainer] Removing container(s): ${containerList.join(", ")}...`,
	);
	chatService.infoLine(`[removeContainer] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 1024 * 1024,
		});

		chatService.systemLine(
			`[removeContainer] Successfully removed container(s): ${containerList.join(", ")}`,
		);
		return {
			ok: true,
			exitCode: exitCode,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
			containers: containerList,
		};
	} catch (err) {
		chatService.errorLine(`[removeContainer] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.code === "number" ? err.code : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "Remove one or more Docker containers";

export const parameters = z.object({
	containers: z
		.union([z.string(), z.array(z.string())])
		.describe("Container ID(s) or name(s) to remove"),
	force: z
		.boolean()
		.default(false)
		.describe("Whether to force the removal of a running container"),
	volumes: z
		.boolean()
		.default(false)
		.describe(
			"Whether to remove anonymous volumes associated with the container",
		),
	link: z
		.boolean()
		.default(false)
		.describe("Whether to remove the specified link"),
	timeoutSeconds: z.number().int().default(30).describe("Timeout in seconds"),
});
