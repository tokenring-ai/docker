import {execa} from "execa";
import {shellEscape} from "@token-ring/utility/shellEscape";
import DockerService from "../DockerService.ts";
import ChatService from "@token-ring/chat/ChatService";
import {z} from "zod";

import {Registry} from "@token-ring/registry";

interface StopContainerResult {
    ok: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    containers: string[];
}


/**
 * Stop one or more Docker containers
 */
export async function execute(
    {containers, time = 10, timeoutSeconds = 30}: {
        containers: string | string[];
        time?: number;
        timeoutSeconds?: number
    },
    registry: Registry,
): Promise<StopContainerResult | { error: string }> {
    const chatService = registry.requireFirstServiceByType(ChatService);
    const dockerService = registry.requireFirstServiceByType(DockerService);

    // Ensure DockerService is available
    if (!dockerService) {
        chatService.errorLine(
            `[stopContainer] DockerService not found, can't perform Docker operations without Docker connection details`,
        );
        return {error: "DockerService not found, can't perform Docker operations without Docker connection details"};
    }

    // Validate containers argument
    if (!containers) {
        chatService.errorLine("[stopContainer] containers is required");
        return {error: "containers is required"};
    }

    // Convert single container to array
    const containerList = Array.isArray(containers) ? containers : [containers];
    if (containerList.length === 0) {
        chatService.errorLine(
            "[stopContainer] at least one container must be specified",
        );
        return {error: "at least one container must be specified"};
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

    // Add time parameter if it differs from default
    if (time !== 10) {
        cmd += ` -t ${shellEscape(String(time))}`;
    }

    // Append container identifiers
    cmd += ` ${containerList.map((c) => shellEscape(c)).join(" ")}`;

    chatService.infoLine(
        `[stopContainer] Stopping container(s): ${containerList.join(", ")}...`,
    );
    chatService.infoLine(`[stopContainer] Executing: ${cmd}`);

    const {stdout, stderr, exitCode} = await execa(cmd, {
        shell: true,
        timeout: timeout * 1000,
        maxBuffer: 1024 * 1024,
    });

    chatService.systemLine(
        `[stopContainer] Successfully stopped container(s): ${containerList.join(", ")}`,
    );
    return {
        ok: true,
        exitCode,
        stdout: stdout?.trim() || "",
        stderr: stderr?.trim() || "",
        containers: containerList,
    };
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
