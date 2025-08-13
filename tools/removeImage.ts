import {execa} from "execa";
import {shellEscape} from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import {z} from "zod";


/**
 * Remove one or more Docker images
 * @param {object} args
 * @param {string|string[]} args.images - Image ID(s) or name(s) to remove
 * @param {boolean} [args.force=false] - Whether to force removal of the image
 * @param {boolean} [args.noPrune=false] - Whether to prevent the pruning of parent images
 * @param {number} [args.timeoutSeconds=30] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the remove operation
 */

export async function execute(
	{ images, force = false, noPrune = false, timeoutSeconds = 30 },
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

	if (!images) {
		chatService.errorLine("[removeImage] images is required");
		return { error: "images is required" };
	}

	// Convert single image to array
	const imageList = Array.isArray(images) ? images : [images];
	if (imageList.length === 0) {
		chatService.errorLine("[removeImage] at least one image must be specified");
		return { error: "at least one image must be specified" };
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

	// Construct the docker rmi command
	const timeout = Math.max(5, Math.min(timeoutSeconds, 120));
	let cmd = `timeout ${timeout}s ${dockerCmd} rmi`;

	// Add force flag if specified
	if (force) {
		cmd += ` -f`;
	}

	// Add no-prune flag if specified
	if (noPrune) {
		cmd += ` --no-prune`;
	}

	// Add images
	cmd += ` ${imageList.map((image) => shellEscape(image)).join(" ")}`;

	chatService.infoLine(
		`[removeImage] Removing image(s): ${imageList.join(", ")}...`,
	);
	chatService.infoLine(`[removeImage] Executing: ${cmd}`);

	try {
		const { stdout, stderr, exitCode } = await execa(cmd, {
			shell: true,
			timeout: timeout * 1000,
			maxBuffer: 1024 * 1024,
		});

		chatService.systemLine(
			`[removeImage] Successfully removed image(s): ${imageList.join(", ")}`,
		);
		return {
			ok: true,
			exitCode: exitCode,
			stdout: stdout?.trim() || "",
			stderr: stderr?.trim() || "",
			images: imageList,
		};
	} catch (err) {
		chatService.errorLine(`[removeImage] Error: ${err.message}`);
		return {
			ok: false,
			exitCode: typeof err.code === "number" ? err.code : 1,
			stdout: err.stdout?.trim() || "",
			stderr: err.stderr?.trim() || "",
			error: err.shortMessage || err.message,
		};
	}
}

export const description = "Remove one or more Docker images";

export const parameters = z
	.object({
		images: z.union([z.string(), z.array(z.string())], {
			description: "Image ID(s) or name(s) to remove",
		}),
		force: z
			.boolean()
			.optional()
			.default(false)
			.describe("Whether to force removal of the image"),
		noPrune: z
			.boolean()
			.optional()
			.default(false)
			.describe("Whether to prevent the pruning of parent images"),
		timeoutSeconds: z
			.number()
			.int()
			.optional()
			.default(30)
			.describe("Timeout in seconds"),
	})
	.strict();
