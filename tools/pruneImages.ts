import {execa} from "execa";
import {shellEscape} from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import {z} from "zod";


/**
 * Prune unused Docker images
 * @param {object} args
 * @param {boolean} [args.all=false] - Whether to remove all unused images, not just dangling ones
 * @param {string} [args.filter] - Filter images based on conditions provided
 * @param {number} [args.timeoutSeconds=60] - Timeout in seconds
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the prune operation
 */
import {Registry} from "@token-ring/registry";

interface PruneImagesResult {
    ok: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    spaceReclaimed: string;
}

export async function execute(
    {all = false, filter, timeoutSeconds = 60}: { all?: boolean; filter?: string; timeoutSeconds?: number },
    registry: Registry,
): Promise<PruneImagesResult | { error: string }> {
    const chatService = registry.requireFirstServiceByType(ChatService);
    const dockerService = registry.requireFirstServiceByType(DockerService);
    if (!dockerService) {
        chatService.errorLine(
            `[pruneImages] Error: DockerService not found, can't perform Docker operations without Docker connection details`,
        );
        return {error: "DockerService not configured"};
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

    // Construct the docker image prune command
    const timeout = Math.max(5, Math.min(timeoutSeconds, 300));
    let cmd = `timeout ${timeout}s ${dockerCmd} image prune -f`; // Always use -f to avoid interactive prompt

    // Add all flag if specified
    if (all) {
        cmd += ` -a`;
    }

    // Add filter if specified
    if (filter) {
        cmd += ` --filter ${shellEscape(filter)}`;
    }

    chatService.infoLine(`[pruneImages] Pruning unused Docker images...`);
    chatService.infoLine(`[pruneImages] Executing: ${cmd}`);

    const {stdout, stderr, exitCode} = await execa(cmd, {
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

    chatService.systemLine(
        `[pruneImages] Successfully pruned unused Docker images. Space reclaimed: ${spaceReclaimed}`,
    );
    return {
        ok: true,
        exitCode: exitCode,
        stdout: stdout?.trim() || "",
        stderr: stderr?.trim() || "",
        spaceReclaimed: spaceReclaimed,
    };
}

export const description = "Prune unused Docker images";

export const parameters = z.object({
    all: z
        .boolean()
        .default(false)
        .describe("Whether to remove all unused images, not just dangling ones"),
    filter: z
        .string()
        .optional()
        .describe("Filter images based on conditions provided"),
    force: z
        .boolean()
        .default(false)
        .describe("Whether to force removal of images"),
    timeoutSeconds: z.number().int().default(60).describe("Timeout in seconds"),
});
