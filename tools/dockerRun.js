import DockerService from "../DockerService.js";
import ChatService from "@token-ring/chat/ChatService";
import {FileSystemService} from "@token-ring/filesystem";
import { z } from "zod";

/**
 * Runs a shell command in an ephemeral Docker container
 * @param {object} args
 * @param {string} args.image - Docker image name
 * @param {string} args.cmd - Command to run in the container
 * @param {object} [args.env={}] - Environment variables to pass
 * @param {string} [args.workdir] - Working directory inside the container
 * @param {number} [args.timeoutSeconds=60] - Timeout for the command in seconds
 * @param {string} [args.mountSrc] - Bind-mount the source directory at this target path
 * @param {TokenRingRegistry} registry - The package registry
 * @returns {Promise<object>} Result of the docker run operation
 */
export async function execute({image, cmd, env = {}, workdir, timeoutSeconds = 60, mountSrc}, registry) {
 const chatService = registry.requireFirstServiceByType(ChatService);
 const filesystem = registry.requireFirstServiceByType(FileSystemService);
 const dockerService = registry.requireFirstServiceByType(DockerService);

 if (!image || !cmd) {
  chatService.errorLine(("[dockerRun] image and cmd required"));
  return {error: "image and cmd required"};
 }

 // Build Docker command arguments
 const dockerArgs = ["run", "--rm"];

 // Add host if not using default
 if (dockerService.getHost() !== "unix:///var/run/docker.sock") {
  dockerArgs.unshift("-H", dockerService.getHost());
 }

 // Add TLS settings if needed
 const tlsConfig = dockerService.getTLSConfig();
 if (tlsConfig.tlsVerify) {
  dockerArgs.unshift("--tls");

  if (tlsConfig.tlsCACert) {
   dockerArgs.unshift(`--tlscacert=${tlsConfig.tlsCACert}`);
  }

  if (tlsConfig.tlsCert) {
   dockerArgs.unshift(`--tlscert=${tlsConfig.tlsCert}`);
  }

  if (tlsConfig.tlsKey) {
   dockerArgs.unshift(`--tlskey=${tlsConfig.tlsKey}`);
  }
 }

 // Add environment variables
 Object.entries(env).forEach(([k, v]) => {
  dockerArgs.push("-e", `${k}=${v}`);
 });

 // Add working directory
 if (workdir) {
  dockerArgs.push("-w", workdir);
 }

 // Add mount if specified
 if (mountSrc) {
  dockerArgs.push("-v", `${filesystem.baseDirectory}:${mountSrc}`);
 }

 // Add image and command
 dockerArgs.push(image, "sh", "-c", cmd);

 const timeout = Math.max(5, Math.min(timeoutSeconds || 60, 600));

 // Create the final command with timeout
 const finalCommand = ["timeout", `${timeout}s`, "docker", ...dockerArgs];

 chatService.infoLine(("[dockerRun] Executing: " + finalCommand.join(" ")));

 try {
  const result = await filesystem.executeCommand(finalCommand, {
   timeoutSeconds: timeout
  });

  return {
   ok: result.ok,
   exitCode: result.exitCode,
   stdout: result.stdout?.trim() || "",
   stderr: result.stderr?.trim() || "",
   error: result.ok ? null : `Command failed with exit code ${result.exitCode}`
  };
 } catch (err) {
  return {
   ok: false,
   exitCode: 1,
   stdout: "",
   stderr: "",
   error: err.message
  };
 }
}

export const description = "Runs a shell command in an ephemeral Docker container (docker run --rm). Returns the result (stdout, stderr, exit code). Now also supports mounting the source directory at a custom path.";

export const parameters = z.object({
 image: z.string().describe("Docker image name (e.g., ubuntu:latest)"),
 cmd: z.string().describe("Command to run in the container (e.g., 'ls -l /')"),
 env: z.record(z.string()).optional().describe("Environment variables to pass (optional)"),
 workdir: z.string().optional().describe("Working directory inside the container (optional)"),
 timeoutSeconds: z.number().int().optional().describe("Timeout for the command, in seconds (default: 60)."),
 mountSrc: z.string().optional().describe("Bind-mount the source directory at this target path inside the container (optional)")
});
