import {execa} from "execa";
import {shellEscape} from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import {z} from "zod";


/**
 * Prune unused Docker volumes
 * @param {object} args
 * @param {string} [args.filter] - Filter volumes based on conditions provided
 * @param {number} [args.timeoutSeconds=60] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the prune operation
 */

export async function execute({ filter, timeoutSeconds = 60 }, registry) {
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

	// Construct the docker volume prune command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 300));
	let cmd = `timeout ${timeout}s ${dockerCmd} volume prune -f`; // Always use -f to avoid interactive prompt

	// Add filter if specified
	if (filter) {
		cmd += ` --filter ${shellEscape(filter)}`;
	}

	chatService.infoLine(`[pruneVolumes] Pruning unused Docker volumes...`);
	chatService.infoLine(`[pruneVolumes] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 1024 * 1024,
		});

		// Parse the output to extract the amount of space reclaimed
		let spaceReclaimed = "0B";
		const match = stdout.match(/Total reclaimed space: ([\d\.]+\s?[KMGT]?B)/i);
		if (match) {
			spaceReclaimed = match[1];
		}

		// Parse the output to extract the number of volumes deleted
		let volumesDeleted = 0;
		const deletedMatch = stdout.match(/Deleted Volumes:\s*([^]*?)Total/);
		if (deletedMatch) {
			const deletedText = deletedMatch[1].trim();
			volumesDeleted = deletedText
				.split("\n")
				.filter((line) => line.trim()).length;
		}

		chatService.systemLine(
			`[pruneVolumes] Successfully pruned unused Docker volumes. Space reclaimed: ${spaceReclaimed}`,
		);
		return {
			ok: true,
			exitCode: exitCode,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
			spaceReclaimed: spaceReclaimed,
			volumesDeleted: volumesDeleted,
		};
	} catch (err) {
		chatService.errorLine(`[pruneVolumes] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.code === "number" ? err.code : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "Prune unused Docker volumes";

export const parameters = z.object({
	filter: z
		.string()
		.describe("Filter volumes based on conditions provided")
		.optional(),
	force: z
		.boolean()
		.describe("Whether to force removal of volumes")
		.default(false),
	timeoutSeconds: z.number().int().describe("Timeout in seconds").default(60),
});
