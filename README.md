@token-ring/docker

Overview
- @token-ring/docker provides Docker integration for Token Ring agents and tools.
- It exposes a DockerService for configuration (host/TLS) and a dockerRun tool to execute one-off commands inside ephemeral containers (docker run --rm).

Features
- Configure Docker connection (local socket, tcp, or ssh) via DockerService.
- Optional TLS verification with CA/cert/key paths.
- Run a shell command in a temporary container with:
  - Image selection
  - Environment variables
  - Working directory inside the container
  - Timeout control
  - Optional bind-mount of the host source directory at a custom path
- Structured results (ok, exitCode, stdout, stderr, error).

Installation
This package is part of the Token Ring monorepo. If you are using packages individually, ensure the following peer packages are available in your workspace:
- @token-ring/registry
- @token-ring/chat
- @token-ring/filesystem

Usage
1) Register services
In your setup, register the DockerService (and the required ChatService and FileSystemService) with the ServiceRegistry.

TypeScript example

import { ServiceRegistry } from "@token-ring/registry";
import { ChatService } from "@token-ring/chat";
import { FileSystemService } from "@token-ring/filesystem";
import { DockerService, tools as dockerTools } from "@token-ring/docker";

const registry = new ServiceRegistry();

// Register core services
registry.registerService(new ChatService());
registry.registerService(new FileSystemService({ baseDirectory: process.cwd() }));

// Register Docker with optional host/TLS configuration
registry.registerService(
  new DockerService({
    host: "unix:///var/run/docker.sock", // e.g. tcp://host:2375 or ssh://user@host
    tlsVerify: false,
    // tlsCACert: "/path/ca.pem",
    // tlsCert: "/path/cert.pem",
    // tlsKey: "/path/key.pem",
  })
);

// 2) Run a command in an ephemeral container
const result = await dockerTools.dockerRun.execute(
  {
    image: "ubuntu:22.04",
    cmd: "echo hello && uname -a",
    env: { HELLO: "world" },
    workdir: "/workspace",
    timeoutSeconds: 60,
    // Optional: bind-mount the host source directory to a path inside the container
    mountSrc: "/workspace",
  },
  registry
);

if (result.ok) {
  console.log("stdout:\n", result.stdout);
} else {
  console.error("dockerRun error:", result.error);
}

API
DockerService (class)
- constructor(params?: { host?: string; tlsVerify?: boolean; tlsCACert?: string; tlsCert?: string; tlsKey?: string; })
  - host: Docker host (defaults to unix:///var/run/docker.sock). Supports tcp:// and ssh:// as well.
  - tlsVerify: enable TLS verification.
  - tlsCACert, tlsCert, tlsKey: paths to the CA, client certificate, and client key files.
- getHost(): string
- getTLSConfig(): { tlsVerify: boolean; tlsCACert?: string; tlsCert?: string; tlsKey?: string; }

Tools
- dockerRun.execute(args, registry): Promise<{ ok?: boolean; exitCode?: number; stdout?: string; stderr?: string; error?: string; }>
  - args
    - image: string (required) — Docker image (e.g., ubuntu:latest)
    - cmd: string (required) — Command to run in the container (executed as sh -c "cmd")
    - env?: Record<string,string> — Environment variables
    - workdir?: string — Working directory inside the container
    - timeoutSeconds?: number — Command timeout in seconds (default: 60; clamped to [5, 600])
    - mountSrc?: string — If set, bind-mounts the host source directory (filesystem.baseDirectory) to this target path inside the container
  - Behavior
    - Uses `docker run --rm` to ensure container is removed after exit.
    - Honors DockerService host/TLS settings by adding -H/--tls flags when needed.
    - Logs command execution via ChatService.

Requirements and Notes
- Docker must be installed and available on the host (docker CLI accessible).
- For non-default hosts or TLS, ensure proper permissions and certificate paths.
- On Linux, access to /var/run/docker.sock may require group membership (e.g., docker group) or root privileges.
- Timeout is enforced via the `timeout` command; ensure it is available on the system.

Package Metadata
- Name: @token-ring/docker
- Exports: DockerService, tools.dockerRun

License
MIT, see LICENSE in this directory.
