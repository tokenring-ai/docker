import { execa } from "execa";
import { shellEscape } from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import { z } from "zod";

/**
 * List Docker images
 * @param {object} args
 * @param {boolean} [args.all=false] - Whether to show all images (default hides intermediate images)
 * @param {boolean} [args.quiet=false] - Whether to only display image IDs
 * @param {boolean} [args.digests=false] - Whether to show digests
 * @param {string} [args.filter] - Filter output based on conditions provided
 * @param {string} [args.format="json"] - Format the output (json or table)
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} List of images
 */
export default execute;
export async function execute(
	{
		all = false,
		quiet = false,
		digests = false,
		filter,
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

	// Construct the docker images command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
	let cmd = `timeout ${timeout}s ${dockerCmd} images`;

	// Add all flag if specified
	if (all) {
		cmd += ` -a`;
	}

	// Add quiet flag if specified
	if (quiet) {
		cmd += ` -q`;
	}

	// Add digests flag if specified
	if (digests) {
		cmd += ` --digests`;
	}

	// Add filter if specified
	if (filter) {
		cmd += ` --filter ${shellEscape(filter)}`;
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

	chatService.infoLine(`[listImages] Listing images...`);
	chatService.infoLine(`[listImages] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 1024 * 1024,
		});

		// Parse the output
		let images;
		if (format === "json" && !quiet) {
			try {
				// Split by newline and parse each line as JSON
				images = stdout
					.trim()
					.split("\n")
					.filter((line) => line.trim())
					.map((line) => JSON.parse(line));
			} catch (e) {
				chatService.errorLine(
					`[listImages] Error parsing JSON output: ${e.message}`,
				);
				images = stdout.trim();
			}
		} else {
			images = stdout.trim();
		}

		chatService.systemLine(`[listImages] Successfully listed images`);
		return {
			ok: true,
			exitCode: exitCode,
			images: images,
			count: Array.isArray(images)
				? images.length
				: stdout
						.trim()
						.split("\n")
						.filter((line) => line.trim()).length,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
		};
	} catch (err) {
		chatService.errorLine(`[listImages] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.exitCode === "number" ? err.exitCode : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "List Docker images";

export const parameters = z.object({
	all: z
		.boolean()
		.default(false)
		.describe("Whether to show all images (default hides intermediate images)"),
	quiet: z
		.boolean()
		.default(false)
		.describe("Whether to only display image IDs"),
	digests: z.boolean().default(false).describe("Whether to show digests"),
	filter: z
		.string()
		.optional()
		.describe("Filter output based on conditions provided"),
	format: z
		.string()
		.default("json")
		.describe("Format the output (json or table)"),
	timeoutSeconds: z.number().int().default(30).describe("Timeout in seconds"),
});
