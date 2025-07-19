import { execa } from "execa";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * List Docker containers
 * @param {object} args
 * @param {boolean} [args.all=false] - Whether to show all containers (default shows just running)
 * @param {boolean} [args.quiet=false] - Whether to only display container IDs
 * @param {number} [args.limit] - Number of containers to show
 * @param {string} [args.filter] - Filter output based on conditions provided
 * @param {boolean} [args.size=false] - Display total file sizes
 * @param {string} [args.format="json"] - Format the output (json or table)
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} List of containers
 */
export default execute;
export async function execute(
	{
		all = false,
		quiet = false,
		limit,
		filter,
		size = false,
		format = "json",
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

	// Construct the docker ps command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
	let cmd = `timeout ${timeout}s ${dockerCmd} ps`;

	// Add all flag if specified
	if (all) {
		cmd += ` -a`;
	}

	// Add quiet flag if specified
	if (quiet) {
		cmd += ` -q`;
	}

	// Add limit if specified
	if (limit) {
		cmd += ` -n ${shellEscape(String(limit))}`;
	}

	// Add filter if specified
	if (filter) {
		cmd += ` --filter ${shellEscape(filter)}`;
	}

	// Add size flag if specified
	if (size) {
		cmd += ` -s`;
	}

	// Add format
	if (format === "json") {
		cmd += ` --format '{{json .}}'`;
	} else if (format === "table") {
		// Default table format
	} else {
		// Custom format
		cmd += ` --format ${shellEscape(format)}`;
	}

	chatService.infoLine(`[listContainers] Listing containers...`);
	chatService.infoLine(`[listContainers] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 1024 * 1024,
		});

		// Parse the output
		let containers;
		if (format === "json" && !quiet) {
			try {
				// Split by newline and parse each line as JSON
				containers = stdout
					.trim()
					.split("\n")
					.filter((line) => line.trim())
					.map((line) => JSON.parse(line));
			} catch (e) {
				chatService.errorLine(
					`[listContainers] Error parsing JSON output: ${e.message}`,
				);
				containers = stdout.trim();
			}
		} else {
			containers = stdout.trim();
		}

		chatService.systemLine(`[listContainers] Successfully listed containers`);
		return {
			ok: true,
			exitCode: exitCode,
			containers: containers,
			count: Array.isArray(containers)
				? containers.length
				: stdout
						.trim()
						.split("\n")
						.filter((line) => line.trim()).length,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
		};
	} catch (err) {
		chatService.errorLine(`[listContainers] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.exitCode === "number" ? err.exitCode : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "List Docker containers";

export const parameters = z.object({
	all: z
		.boolean()
		.describe("Whether to show all containers (default shows just running)")
		.default(false),
	quiet: z
		.boolean()
		.describe("Whether to only display container IDs")
		.default(false),
	limit: z.number().int().describe("Number of containers to show").optional(),
	filter: z
		.string()
		.describe("Filter output based on conditions provided")
		.optional(),
	size: z.boolean().describe("Display total file sizes").default(false),
	format: z
		.string()
		.describe("Format the output (json or table)")
		.default("json"),
	timeoutSeconds: z.number().int().describe("Timeout in seconds").default(30),
});
