import {execa} from "execa";
import {shellEscape} from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import {z} from "zod";


/**
 * Push a Docker image to a registry
 * @param {object} args
 * @param {string} args.tag - The image tag to push
 * @param {boolean} [args.allTags=false] - Whether to push all tags of the image
 * @param {number} [args.timeoutSeconds=300] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the push operation
 */

export async function execute(
	{ tag, allTags = false, timeoutSeconds = 300 },
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

	if (!tag) {
		chatService.errorLine("[pushImage] tag is required");
		return { error: "tag is required" };
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

	// Construct the docker push command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 1800)); // Max 30 minutes
	let cmd = `timeout ${timeout}s ${dockerCmd} push`;

	// Add all-tags flag if specified
	if (allTags) {
		cmd += ` --all-tags`;
	}

	// Add tag
	cmd += ` ${shellEscape(tag)}`;

	chatService.infoLine(`[pushImage] Pushing image ${tag}...`);
	chatService.infoLine(`[pushImage] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 5 * 1024 * 1024,
		});
		chatService.systemLine(`[pushImage] Successfully pushed image ${tag}`);
		return {
			ok: true,
			exitCode: exitCode,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
			tag: tag,
		};
	} catch (err) {
		chatService.errorLine(`[pushImage] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.exitCode === "number" ? err.exitCode : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "Push a Docker image to a registry";
export const parameters = z.object({
	tag: z.string().describe("The image tag to push"),
	allTags: z
		.boolean()
		.describe("Whether to push all tags of the image")
		.default(false)
		.optional(),
	timeoutSeconds: z
		.number()
		.int()
		.describe("Timeout in seconds")
		.default(300)
		.optional(),
});
