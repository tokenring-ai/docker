# Docker Package Documentation

## Overview

The `@tokenring-ai/docker` package provides Docker integration for Token Ring AI agents. It enables interaction with Docker through a configurable service and a set of tools for common operations such as running containers, building images, listing resources, and managing container lifecycles. The package supports local Docker via Unix socket, remote hosts via TCP or SSH, and optional TLS configuration for secure connections.

Key features include:
- Ephemeral container execution for one-off commands (via `dockerRun` tool).
- Persistent container management via `DockerSandboxProvider`, which implements the `@tokenring-ai/sandbox` interface.
- CLI-based Docker commands executed securely using `execa`, with support for timeouts, host/TLS settings, and result parsing.
- Integration with Token Ring's agent ecosystem, requiring services like `FileSystemService` for mounts and logging via agents.

This package is designed for AI agents to perform containerized tasks, such as code execution in isolated environments, image building, and resource inspection.

## Installation/Setup

This package is part of the Token Ring monorepo. To use it individually:

1. Install via npm/yarn:
   ```
   npm install @tokenring-ai/docker
   ```
   Ensure peer dependencies are met (see Dependencies section).

2. Register services in your Token Ring setup:
   ```typescript
   import { ServiceRegistry } from "@tokenring-ai/registry";
   import { DockerService } from "@tokenring-ai/docker";
   import { FileSystemService } from "@tokenring-ai/filesystem";

   const registry = new ServiceRegistry();
   registry.registerService(new FileSystemService({ baseDirectory: process.cwd() }));
   registry.registerService(new DockerService({
     host: "unix:///var/run/docker.sock", // Default
     tlsVerify: false, // Optional TLS
   }));
   ```

3. Ensure Docker is installed and accessible on the host machine. For local Unix socket, add the user to the `docker` group or run with sufficient privileges.

4. For remote/TLS setups, provide valid certificate paths.

Build and test:
- Run `npm run eslint` for linting.
- No specific build step; TypeScript compiles on import.

## Package Structure

```
pkg/docker/
├── index.ts              # Main exports: DockerService, DockerSandboxProvider, tools
├── package.json          # Package metadata and dependencies
├── tsconfig.json         # TypeScript configuration
├── types.ts              # Shared interfaces (TLSConfig, DockerCommandResult)
├── DockerService.ts      # Core service for Docker configuration (host, TLS)
├── DockerSandboxProvider.ts # Sandbox implementation for persistent containers
├── tools.ts              # Re-exports all tools
├── tools/                # Individual tool modules
│   ├── dockerRun.ts      # Run ephemeral containers
│   ├── buildImage.ts     # Build images from Dockerfile
│   ├── listImages.ts     # List Docker images
│   ├── listContainers.ts # List Docker containers
│   ├── getContainerLogs.ts # Retrieve container logs
│   ├── execInContainer.ts # Execute commands in running containers
│   ├── startContainer.ts # Start stopped containers
│   ├── stopContainer.ts  # Stop running containers
│   ├── removeContainer.ts # Remove containers
│   ├── pushImage.ts      # Push images to registry
│   └── ... (other tools like tagImage, prune, etc.)
└── README.md             # This documentation
├── LICENSE               # MIT License
```

The structure separates configuration (DockerService), persistent management (DockerSandboxProvider), and agent tools (tools/).

## Core Components

### DockerService

**Description**: A Token Ring service that configures Docker connection parameters. It does not execute commands but provides host and TLS details to tools and providers. All Docker operations inherit these settings.

**Key Methods**:
- `constructor(params?: DockerServiceParams)`: Initializes with optional host and TLS options.
  - Parameters: `{ host?: string; tlsVerify?: boolean; tlsCACert?: string; tlsCert?: string; tlsKey?: string }`
  - Default: `host = "unix:///var/run/docker.sock"`, `tlsVerify = false`.

- `getHost(): string`: Returns the configured Docker host (e.g., `unix:///var/run/docker.sock`, `tcp://host:2375`, `ssh://user@host`).

- `getTLSConfig(): TLSConfig`: Returns TLS settings object.

**Interactions**: Tools and DockerSandboxProvider query this service to build Docker CLI commands with appropriate `-H` and `--tls` flags.

### DockerSandboxProvider

**Description**: Extends `@tokenring-ai/sandbox/SandboxProvider` to manage persistent Docker containers. Supports creating, executing in, stopping, logging, and removing containers using Docker CLI.

**Key Methods**:
- `constructor(params?: DockerSandboxProviderParams)`: Similar to DockerService, accepts host and TLS params.

- `async createContainer(options: SandboxOptions): Promise<SandboxResult>`:
  - Creates a detached container running `sleep infinity` for persistence.
  - Parameters: `{ image?: string (default: "ubuntu:latest"); workingDir?: string; environment?: Record<string, string>; timeout?: number (default: 30) }`
  - Returns: `{ containerId: string; status: "running" }`
  - Example:
    ```typescript
    const provider = new DockerSandboxProvider();
    const result = await provider.createContainer({ image: "node:18", environment: { NODE_ENV: "test" } });
    console.log(result.containerId);
    ```

- `async executeCommand(containerId: string, command: string): Promise<ExecuteResult>`:
  - Runs `docker exec` with `sh -c command`.
  - Returns: `{ stdout: string; stderr: string; exitCode: number }`

- `async stopContainer(containerId: string): Promise<void>`: Runs `docker stop`.

- `async getLogs(containerId: string): Promise<LogsResult>`: Runs `docker logs`, returns `{ logs: string }`.

- `async removeContainer(containerId: string): Promise<void>`: Runs `docker rm -f`.

**Interactions**: Integrates with DockerService for connection settings. Uses `shellEscape` for secure command building. Suitable for long-running sandboxed executions in AI workflows.

### Tools

Tools are agent-executable functions (e.g., `execute(args, agent)`) that perform Docker operations. They require `DockerService` and often `FileSystemService`. All tools build commands dynamically with host/TLS, execute via `execa`, and return structured results (extending `DockerCommandResult`).

- **dockerRun**: Runs ephemeral containers (`docker run --rm`).
  - Args: `{ image: string; cmd: string; workdir?: string; timeoutSeconds?: number; mountSrc?: string }`
  - Supports mounting host source dir via `FileSystemService`.

- **buildImage**: Builds images (`docker build`).
  - Args: `{ context: string; tag: string; dockerfile?: string; buildArgs?: Record<string,string>; noCache?: boolean; pull?: boolean; timeoutSeconds?: number }`

- **listImages** / **listContainers**: Lists resources (`docker images` / `ps`) with filters, formats (json/table).
  - Parses JSON output into arrays.

- **getContainerLogs**: Retrieves logs (`docker logs`) with options like `--tail`, `--since`.
  - Returns `{ logs: string; lineCount: number }`.

- **execInContainer**: Executes in running containers (`docker exec`).
  - Supports env, user, privileged, interactive/TTY.

- **startContainer** / **stopContainer** / **removeContainer**: Lifecycle management for one or more containers.
  - Supports force, volumes, timeouts.

- **pushImage**: Pushes to registry (`docker push`).

Tools interact by querying `DockerService`, logging via `agent.infoLine()`, and throwing errors on failure.

## Usage Examples

### 1. Run Ephemeral Command
```typescript
import { Agent } from "@tokenring-ai/agent";
import { dockerRun } from "@tokenring-ai/docker/tools";

const agent = new Agent(registry); // Assume registry with services
const result = await dockerRun.execute({
  image: "ubuntu:22.04",
  cmd: "ls -la /",
  workdir: "/tmp",
  timeoutSeconds: 10,
  mountSrc: "/host-src" // Mounts filesystem.baseDirectory to /host-src
}, agent);

if (result.ok) {
  console.log("Output:", result.stdout);
} else {
  console.error("Error:", result.error);
}
```

### 2. Build and Push Image
```typescript
import { buildImage, pushImage } from "@tokenring-ai/docker/tools";

const buildResult = await buildImage.execute({
  context: "./myapp",
  tag: "myrepo/myapp:v1",
  dockerfile: "Dockerfile.dev",
  buildArgs: { NODE_VERSION: "18" },
  noCache: true
}, agent);

if (buildResult.ok) {
  const pushResult = await pushImage.execute({ tag: "myrepo/myapp:v1" }, agent);
  console.log("Pushed:", pushResult.tag);
}
```

### 3. Persistent Container Management
```typescript
import { DockerSandboxProvider } from "@tokenring-ai/docker";

const provider = new DockerSandboxProvider({ host: "tcp://remote:2375" });
const { containerId } = await provider.createContainer({
  image: "python:3.9",
  environment: { SCRIPT: "print('Hello')"},
  workingDir: "/app"
});

const execResult = await provider.executeCommand(containerId, "python -c 'print(\"In container\")'");
console.log(execResult.stdout);

await provider.stopContainer(containerId);
await provider.removeContainer(containerId);
```

## Configuration Options

- **DockerService Params**:
  - `host`: string – Docker daemon address (default: unix socket).
  - `tlsVerify`: boolean – Enable TLS (default: false).
  - `tlsCACert` / `tlsCert` / `tlsKey`: string – Paths to cert files.

- **Tool-Specific**:
  - Timeouts: Clamped (e.g., 5-600s for runs, up to 1800s for builds).
  - Formats: JSON for structured output in list tools.
  - Mounts: Via `mountSrc` in dockerRun, using `FileSystemService.baseDirectory`.

- Environment: No specific vars; relies on Docker CLI availability.

## API Reference

### Public Exports
- `DockerService`: See Core Components.
- `DockerSandboxProvider`: See Core Components.
- `tools`: Namespace with all tools (e.g., `tools.dockerRun.execute(args, agent)`).
- `types`: `TLSConfig`, `DockerCommandResult`.

### Tool Signatures (Examples)
- `dockerRun.execute({ image: string, cmd: string, ... }, Agent): Promise<DockerCommandResult>`
- `buildImage.execute({ context: string, tag: string, ... }, Agent): Promise<BuildResult & DockerCommandResult>`
- `listImages.execute({ all?: boolean, format?: "json"|"table", ... }, Agent): Promise<ListImagesResult & DockerCommandResult>`

All tools use Zod schemas for input validation (e.g., `inputSchema`).

## Dependencies

- `@tokenring-ai/agent` (0.1.0): For Agent integration.
- `@tokenring-ai/filesystem` (0.1.0): For mounts and command execution.
- `@tokenring-ai/sandbox` (0.1.0): For DockerSandboxProvider.
- `@tokenring-ai/utility` (0.1.0): For shell escaping.
- `execa` (^9.6.0): Secure CLI execution.
- `glob-gitignore` (^1.0.15): Not actively used in core (possibly legacy).
- `zod`: For schema validation in tools.

External: Requires Docker CLI installed on host.

## Contributing/Notes

- **Testing**: No dedicated tests in package; test via agent integration. Use tools like `listContainers` for verification.
- **Building**: TypeScript; no build step needed beyond import.
- **Limitations**:
  - Relies on system `docker` CLI and `timeout` command.
  - Unix socket requires Docker permissions; remote needs network access.
  - Binary/large outputs may hit `maxBuffer` limits (e.g., 5MB for builds).
  - No direct Docker API; all via CLI for simplicity.
  - Error handling: Tools throw on failure; catch in agent workflows.
- **Best Practices**: Use ephemeral runs for isolation; persistent for stateful tasks. Validate inputs with schemas.
- **License**: MIT (see LICENSE).
- **Version**: 0.1.0 – Early development; expect API changes.

For contributions, follow Token Ring guidelines: lint with ESLint, focus on secure CLI usage.