import SandboxProvider, {
  type ExecuteResult,
  type LogsResult,
  type SandboxOptions,
  type SandboxResult
} from "@tokenring-ai/sandbox/SandboxProvider";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {execa} from "execa";

export interface DockerSandboxProviderParams extends TLSConfig {
  host?: string;
  tlsVerify?: boolean;
}

export interface TLSConfig {
  tlsCACert?: string;
  tlsCert?: string;
  tlsKey?: string;
}


export default class DockerSandboxProvider extends SandboxProvider {
  private readonly host: string;
  private readonly tlsConfig?: TLSConfig;

  constructor({
                host = "unix:///var/run/docker.sock",
                tlsVerify = false,
                tlsCACert,
                tlsCert,
                tlsKey,
              }: DockerSandboxProviderParams = {}) {
    super();
    this.host = host;
    if (tlsVerify) {
      this.tlsConfig = {
        tlsCACert,
        tlsCert,
        tlsKey
      }
    }
  }

  async createContainer(options: SandboxOptions = {}): Promise<SandboxResult> {
    const {image = "ubuntu:latest", workingDir, environment, timeout = 30} = options;

    let cmd = `${this.buildDockerCmd()} run -d`;

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
    const cmd = `${this.buildDockerCmd()} exec ${shellEscape(containerId)} sh -c ${shellEscape(command)}`;

    try {
      const {stdout, stderr, exitCode} = await execa(cmd, {shell: true, reject: false});
      return {stdout: stdout || "", stderr: stderr || "", exitCode: exitCode || 0};
    } catch (err: any) {
      return {stdout: "", stderr: err.message, exitCode: 1};
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    const cmd = `${this.buildDockerCmd()} stop ${shellEscape(containerId)}`;
    await execa(cmd, {shell: true});
  }

  async getLogs(containerId: string): Promise<LogsResult> {
    const cmd = `${this.buildDockerCmd()} logs ${shellEscape(containerId)}`;
    const {stdout} = await execa(cmd, {shell: true});
    return {logs: stdout};
  }

  async removeContainer(containerId: string): Promise<void> {
    const cmd = `${this.buildDockerCmd()} rm -f ${shellEscape(containerId)}`;
    await execa(cmd, {shell: true});
  }

  private buildDockerCmd(): string {
    let dockerCmd = "docker";

    if (this.host !== "unix:///var/run/docker.sock") {
      dockerCmd += ` -H ${shellEscape(this.host)}`;
    }

    if (this.tlsConfig) {
      dockerCmd += " --tls";
      const {tlsCACert, tlsCert, tlsKey} = this.tlsConfig;

      if (tlsCACert) dockerCmd += ` --tlscacert=${shellEscape(tlsCACert)}`;
      if (tlsCert) dockerCmd += ` --tlscert=${shellEscape(tlsCert)}`;
      if (tlsKey) dockerCmd += ` --tlskey=${shellEscape(tlsKey)}`;
    }

    return dockerCmd;
  }
}