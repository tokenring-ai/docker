import {type ExecuteResult, type LogsResult, type SandboxOptions, type SandboxProvider, type SandboxResult} from "@tokenring-ai/sandbox/SandboxProvider";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";
import {DockerService} from "./index.ts";

export default class DockerSandboxProvider implements SandboxProvider {
  constructor(readonly dockerService: DockerService) {}

  async createContainer(options: SandboxOptions = {}): Promise<SandboxResult> {
    const {image = "ubuntu:latest", workingDir, environment, timeout = 30} = options;

    let cmd = `${this.dockerService.buildDockerCmd()} run -d`;

    if (workingDir) cmd += ` -w ${shellEscape(workingDir)}`;

    if (environment) {
      for (const [key, value] of Object.entries(environment)) {
        cmd += ` -e ${shellEscape(`${key}=${value}`)}`;
      }
    }

    cmd += ` ${shellEscape(image)} sleep infinity`;

    const {stdout} = await execa(cmd, {shell: true, timeout: timeout * 1000});
    const containerId = stdout.trim();

    return {containerId, status: "running"};
  }

  async executeCommand(containerId: string, command: string): Promise<ExecuteResult> {
    const cmd = `${this.dockerService.buildDockerCmd()} exec ${shellEscape(containerId)} sh -c ${shellEscape(command)}`;

    try {
      const {stdout, stderr, exitCode} = await execa(cmd, {shell: true, reject: false});
      return {stdout: stdout || "", stderr: stderr || "", exitCode: exitCode || 0};
    } catch (err: any) {
      return {stdout: "", stderr: err.message, exitCode: 1};
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    const cmd = `${this.dockerService.buildDockerCmd()} stop ${shellEscape(containerId)}`;
    await execa(cmd, {shell: true});
  }

  async getLogs(containerId: string): Promise<LogsResult> {
    const cmd = `${this.dockerService.buildDockerCmd()} logs ${shellEscape(containerId)}`;
    const {stdout} = await execa(cmd, {shell: true});
    return {logs: stdout};
  }

  async removeContainer(containerId: string): Promise<void> {
    const cmd = `${this.dockerService.buildDockerCmd()} rm -f ${shellEscape(containerId)}`;
    await execa(cmd, {shell: true});
  }
}