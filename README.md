# @tokenring-ai/docker

Comprehensive container management and isolated sandboxing via Docker.

## Overview

The `@tokenring-ai/docker` package enables AI agents to interact with Docker through a configurable service and a set of
tools for Docker operations. It supports local Docker via Unix socket, remote hosts via TCP, and optional TLS
configuration for secure connections. The package provides a `DockerService` for configuration, a
`DockerSandboxProvider` for persistent container management, and 19 tools for comprehensive Docker operations.

### Key Features

- **Ephemeral Container Execution**: Run one-off commands in temporary containers using the `docker_dockerRun` tool
- **Persistent Container Management**: Create, manage, and execute commands in long-running containers via
  `DockerSandboxProvider`
- **Secure Configuration**: Service-based Docker configuration with TLS support
- **Agent Integration**: Seamless integration with Token Ring's agent ecosystem and service architecture
- **Shell Safety**: All operations use proper shell escaping and timeout management
- **Sandbox Provider**: Integrates with the Token Ring sandbox system for container orchestration
- **Comprehensive Toolset**: 19 Docker tools for managing images, containers, networks, stacks, and more

## Installation

```bash
bun install @tokenring-ai/docker
```

## Core Components

### DockerService

**Description**: A Token Ring service that configures Docker connection parameters. It builds Docker CLI commands with
host and TLS settings.

**Constructor Parameters**:

```typescript
interface DockerConfig {
  host?: string;                    // Docker daemon address (e.g., "unix:///var/run/docker.sock")
  tls?: {
    verify?: boolean;              // Default: false
    caCert?: string;               // Path to CA certificate
    cert?: string;                 // Path to client certificate
    key?: string;                  // Path to client key
  };
  sandbox?: boolean;               // Enable sandbox provider (default: false)
}
```

**Key Methods**:

- `buildDockerCmd(): string` - Builds the Docker CLI command with host and TLS settings

**Properties**:

- `name = "DockerService"` - Service identifier
- `description = "Provides Docker functionality"` - Service description
- `options` - The configuration options passed to the constructor

**Example Usage**:

```typescript
import DockerService from "@tokenring-ai/docker/DockerService";

const dockerService = new DockerService({
  host: "unix:///var/run/docker.sock",
  tls: {
    verify: true,
    caCert: "/path/to/ca.crt",
    cert: "/path/to/client.crt",
    key: "/path/to/client.key",
  },
});

const dockerCmd = dockerService.buildDockerCmd();
// Returns: "docker -H unix:///var/run/docker.sock --tls --tlscacert=/path/to/ca.crt --tlscert=/path/to/client.crt --tlskey=/path/to/client.key"
```

### DockerSandboxProvider

**Description**: Implements `SandboxProvider` to manage persistent Docker containers. Creates detached containers that
can execute multiple commands over time.

**Constructor Parameters**:

```typescript
constructor(readonly dockerService: DockerService)
```

**Key Methods**:

- `createContainer(options: SandboxOptions): Promise<SandboxResult>` - Create a new persistent container
- `executeCommand(containerId: string, command: string): Promise<ExecuteResult>` - Execute a command in a running
  container
- `stopContainer(containerId: string): Promise<void>` - Stop a running container
- `getLogs(containerId: string): Promise<LogsResult>` - Get container logs
- `removeContainer(containerId: string): Promise<void>` - Remove a container

**SandboxOptions**:

```typescript
interface SandboxOptions {
  image?: string;                  // Docker image (default: "ubuntu:latest")
  workingDir?: string;            // Working directory inside the container
  environment?: Record<string, string>;  // Environment variables
  timeout?: number;               // Timeout in seconds (default: 30)
}
```

**Example Usage**:

```typescript
import DockerSandboxProvider from "@tokenring-ai/docker/DockerSandboxProvider";
import DockerService from "@tokenring-ai/docker/DockerService";

const dockerService = new DockerService({});
const provider = new DockerSandboxProvider(dockerService);

// Create a persistent container
const { containerId } = await provider.createContainer({
  image: "python:3.9",
  environment: { PYTHONPATH: "/app" },
  workingDir: "/app"
});

const result = await provider.executeCommand(
  containerId,
  "python -c 'print(\"Hello from container\")'"
);

console.log(result.stdout);

// Clean up
await provider.stopContainer(containerId);
await provider.removeContainer(containerId);
```

## Tools

The package provides 19 Docker tools for comprehensive container and image management. Each tool follows the TokenRing
tool pattern with proper input validation, error handling, and agent integration.

### Exported Tools

All tools are exported from `tools.ts` and can be imported individually or as a group:

```typescript
import tools from "@tokenring-ai/docker/tools";
// or import individually
import { dockerRun, listContainers, buildImage } from "@tokenring-ai/docker/tools";
```

### Tools Reference Table

| Tool Name                     | Category    | Description                                    |
|:------------------------------|:------------|:-----------------------------------------------|
| `docker_dockerRun`            | Container   | Run ephemeral containers with bind mounts      |
| `docker_listContainers`       | Container   | List Docker containers                         |
| `docker_startContainer`       | Container   | Start one or more containers                   |
| `docker_stopContainer`        | Container   | Stop one or more containers                    |
| `docker_removeContainer`      | Container   | Remove one or more containers                  |
| `docker_execInContainer`      | Container   | Execute command in running container           |
| `docker_listImages`           | Image       | List Docker images                             |
| `docker_buildImage`           | Image       | Build Docker images from Dockerfile            |
| `docker_removeImage`          | Image       | Remove one or more images                      |
| `docker_tagImage`             | Image       | Tag an image with new name                     |
| `docker_pushImage`            | Image       | Push an image to registry                      |
| `docker_createNetwork`        | Network     | Create a Docker network                        |
| `docker_dockerStack`          | Stack       | Deploy/remove/list Docker stacks in Swarm mode |
| `docker_getContainerLogs`     | Logging     | Get container logs                             |
| `docker_getContainerStats`    | Stats       | Get container statistics                       |
| `docker_authenticateRegistry` | Registry    | Authenticate with Docker registry              |
| `docker_pruneImages`          | Maintenance | Remove unused images                           |
| `docker_pruneVolumes`         | Maintenance | Remove unused volumes                          |

### Tool Reference

#### docker_dockerRun

Runs a shell command in an ephemeral Docker container with the project directory bind-mounted.

**Parameters**:

- `image` (string): Docker image name (e.g., ubuntu:latest)
- `cmd` (string): Command to run in the container
- `timeoutSeconds` (number, optional): Timeout for the command in seconds (default: 60, max: 600)

**Description**: Runs a shell command in an ephemeral Docker container (docker run --rm). Returns the result (stdout,
stderr, exit code). The base directory for the project is bind mounted at /workdir, and the working directory of the
container is set to /workdir. Uses TerminalService for execution.

**Example**:

```typescript
import dockerRun from "@tokenring-ai/docker/tools/dockerRun";

const result = await dockerRun.execute(
  { image: "ubuntu:22.04", cmd: "ls -la /usr/bin", timeoutSeconds: 30 },
  agent
);
```

#### docker_listContainers

List Docker containers.

**Parameters**:

- `all` (boolean, optional): Whether to show all containers (default: false)
- `quiet` (boolean, optional): Whether to only display container IDs (default: false)
- `limit` (number, optional): Number of containers to show
- `filter` (string, optional): Filter output based on conditions
- `size` (boolean, optional): Display total file sizes (default: false)
- `format` (string, optional): Format the output (json or table, default: "json")
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, `containers`, and `count` fields.

**Example**:

```typescript
import listContainers from "@tokenring-ai/docker/tools/listContainers";

const result = await listContainers.execute(
  { all: true, format: "json" },
  agent
);
```

#### docker_listImages

List Docker images.

**Parameters**:

- `all` (boolean, optional): Whether to show all images (default: false)
- `quiet` (boolean, optional): Whether to only display image IDs (default: false)
- `digests` (boolean, optional): Whether to show digests (default: false)
- `filter` (string, optional): Filter output based on conditions
- `format` (string, optional): Format the output (json or table, default: "json")
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, `images`, and `count` fields.

**Example**:

```typescript
import listImages from "@tokenring-ai/docker/tools/listImages";

const result = await listImages.execute(
  { all: true, format: "json" },
  agent
);
```

#### docker_buildImage

Build a Docker image from a Dockerfile.

**Parameters**:

- `context` (string): The build context (directory containing Dockerfile)
- `tag` (string): The tag to apply to the built image
- `dockerfile` (string, optional): Path to the Dockerfile (relative to context)
- `buildArgs` (Record<string, string>, optional): Build arguments to pass to the build
- `noCache` (boolean, optional): Whether to use cache when building (default: false)
- `pull` (boolean, optional): Whether to always pull newer versions of base images (default: false)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 300, max: 1800)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `tag` fields.

**Example**:

```typescript
import buildImage from "@tokenring-ai/docker/tools/buildImage";

const result = await buildImage.execute(
  {
    context: "./myapp",
    tag: "myapp:latest",
    dockerfile: "Dockerfile",
    buildArgs: { NODE_ENV: "production" }
  },
  agent
);
```

#### docker_startContainer

Start one or more Docker containers.

**Parameters**:

- `containers` (string[]): Container ID(s) or name(s) to start (must be non-empty array)
- `attach` (boolean, optional): Whether to attach STDOUT/STDERR (default: false)
- `interactive` (boolean, optional): Whether to attach container's STDIN (default: false)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `containers` fields.

**Example**:

```typescript
import startContainer from "@tokenring-ai/docker/tools/startContainer";

const result = await startContainer.execute(
  { containers: ["my-container"], attach: false },
  agent
);
```

#### docker_stopContainer

Stop one or more Docker containers.

**Parameters**:

- `containers` (string[]): Container ID(s) or name(s) to stop (must be non-empty array)
- `time` (number, optional): Seconds to wait for stop before killing (default: 10)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `containers` fields.

**Example**:

```typescript
import stopContainer from "@tokenring-ai/docker/tools/stopContainer";

const result = await stopContainer.execute(
  { containers: ["my-container"], time: 10 },
  agent
);
```

#### docker_removeContainer

Remove one or more Docker containers.

**Parameters**:

- `containers` (string[]): Container ID(s) or name(s) to remove (must be non-empty array)
- `force` (boolean, optional): Whether to force removal of running container (default: false)
- `volumes` (boolean, optional): Whether to remove anonymous volumes (default: false)
- `link` (boolean, optional): Whether to remove the specified link (default: false)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `containers` fields.

**Example**:

```typescript
import removeContainer from "@tokenring-ai/docker/tools/removeContainer";

const result = await removeContainer.execute(
  { containers: ["my-container"], force: true },
  agent
);
```

#### docker_execInContainer

Execute a command in a running Docker container.

**Parameters**:

- `container` (string): Container name or ID
- `commands` (string[]): Command to execute (array of command arguments)
- `interactive` (boolean, optional): Whether to keep STDIN open (default: false)
- `tty` (boolean, optional): Whether to allocate a pseudo-TTY (default: false)
- `workdir` (string, optional): Working directory inside the container
- `env` (Record<string, string>, optional): Environment variables to set
- `privileged` (boolean, optional): Whether to give extended privileges (default: false)
- `user` (string, optional): Username or UID to execute as
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, `container`, and `command` fields.

**Example**:

```typescript
import execInContainer from "@tokenring-ai/docker/tools/execInContainer";

const result = await execInContainer.execute(
  {
    container: "my-container",
    commands: ["ls", "-la"],
    workdir: "/app",
    env: { NODE_ENV: "production" }
  },
  agent
);
```

#### docker_getContainerLogs

Get logs from a Docker container.

**Parameters**:

- `name` (string): The container name or ID
- `follow` (boolean, optional): Whether to follow log output (default: false)
- `timestamps` (boolean, optional): Whether to show timestamps (default: false)
- `since` (string, optional): Show logs since timestamp
- `until` (string, optional): Show logs before timestamp
- `tail` (number, optional): Number of lines to show (default: 100)
- `details` (boolean, optional): Whether to show extra details (default: false)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `logs`, `lineCount`, `container`, `stdout`, and `stderr` fields.

**Example**:

```typescript
import getContainerLogs from "@tokenring-ai/docker/tools/getContainerLogs";

const result = await getContainerLogs.execute(
  { name: "my-container", tail: 100, timestamps: true },
  agent
);
```

#### docker_getContainerStats

Get stats from a Docker container.

**Parameters**:

- `containers` (string[]): Container name(s) or ID(s) (must be non-empty array)
- `all` (boolean, optional): Whether to show all containers (default: false)
- `noStream` (boolean, optional): Whether to disable streaming stats and only pull one stat (default: true)
- `format` (string, optional): Format the output (json or table, default: "json")
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 10)

**Returns**: Object with `ok`, `exitCode`, `stats`, `containers`, `stdout`, and `stderr` fields.

**Example**:

```typescript
import getContainerStats from "@tokenring-ai/docker/tools/getContainerStats";

const result = await getContainerStats.execute(
  { containers: ["my-container"], noStream: true },
  agent
);
```

#### docker_removeImage

Remove one or more Docker images.

**Parameters**:

- `images` (string[]): Image ID(s) or name(s) to remove (must be non-empty array)
- `force` (boolean, optional): Whether to force removal (default: false)
- `noPrune` (boolean, optional): Whether to prevent pruning parent images (default: false)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `images` fields.

**Example**:

```typescript
import removeImage from "@tokenring-ai/docker/tools/removeImage";

const result = await removeImage.execute(
  { images: ["myapp:latest"], force: true },
  agent
);
```

#### docker_tagImage

Tag a Docker image with a new name and/or tag.

**Parameters**:

- `sourceImage` (string): The source image to tag
- `targetImage` (string): The target image name and tag
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, `sourceImage`, and `targetImage` fields.

**Example**:

```typescript
import tagImage from "@tokenring-ai/docker/tools/tagImage";

const result = await tagImage.execute(
  { sourceImage: "myapp:latest", targetImage: "myregistry/myapp:v1.0" },
  agent
);
```

#### docker_pushImage

Push a Docker image to a registry.

**Parameters**:

- `tag` (string): The image tag to push
- `allTags` (boolean, optional): Whether to push all tags (default: false)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 300, max: 1800)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `tag` fields.

**Example**:

```typescript
import pushImage from "@tokenring-ai/docker/tools/pushImage";

const result = await pushImage.execute(
  { tag: "myregistry/myapp:v1.0", allTags: false },
  agent
);
```

#### docker_createNetwork

Create a Docker network.

**Parameters**:

- `name` (string): The name of the network
- `driver` (string, optional): Driver to manage the network (default: "bridge")
- `options` (Record<string, string>, optional): Driver specific options
- `internal` (boolean, optional): Restrict external access (default: false)
- `subnet` (string, optional): Subnet in CIDR format
- `gateway` (string, optional): Gateway for the subnet
- `ipRange` (string, optional): Allocate container IP from a sub-range
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, `name`, and `id` fields.

**Example**:

```typescript
import createNetwork from "@tokenring-ai/docker/tools/createNetwork";

const result = await createNetwork.execute(
  {
    name: "my-network",
    driver: "bridge",
    subnet: "172.20.0.0/16"
  },
  agent
);
```

#### docker_dockerStack

Launch, update, or remove a Docker stack from the local Docker Swarm.

**Parameters**:

- `action` (enum): Action to perform - "deploy", "remove", or "ps"
- `stackName` (string): Name of the stack
- `composeFile` (string, optional): Path to docker-compose.yml (required for deploy)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 60)

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `error` fields.

**Example**:

```typescript
import dockerStack from "@tokenring-ai/docker/tools/dockerStack";

// Deploy a stack
const result = await dockerStack.execute(
  {
    action: "deploy",
    stackName: "my-stack",
    composeFile: "./docker-compose.yml"
  },
  agent
);
```

#### docker_authenticateRegistry

Authenticate against a Docker registry.

**Parameters**:

- `server` (string): The registry server URL (e.g., `https://index.docker.io/v1/`)
- `username` (string): Username for the registry
- `password` (string): Password for the registry
- `email` (string, optional): Email for the registry account
- `passwordStdin` (boolean, optional): Take the password from stdin (default: false)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 30, max: 120)

**Note**: When `passwordStdin` is true, the password is passed via stdin instead of as a command-line argument for
improved security.

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, `server`, and `username` fields.

**Example**:

```typescript
import authenticateRegistry from "@tokenring-ai/docker/tools/authenticateRegistry";

const result = await authenticateRegistry.execute(
  {
    server: "https://index.docker.io/v1/",
    username: "myuser",
    password: "mypassword"
  },
  agent
);
```

#### docker_pruneImages

Prune unused Docker images.

**Parameters**:

- `all` (boolean, optional): Remove all unused images, not just dangling (default: false)
- `filter` (string, optional): Filter images based on conditions
- `force` (boolean, optional): Whether to force removal (default: false, not used as -f is always applied)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 60, max: 300)

**Note**: The `-f` flag is always used internally to avoid interactive prompts. The `force` parameter in the schema is
not used as the `-f` flag is always applied.

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, and `spaceReclaimed` fields.

**Example**:

```typescript
import pruneImages from "@tokenring-ai/docker/tools/pruneImages";

const result = await pruneImages.execute(
  { all: true },
  agent
);

console.log(`Space reclaimed: ${result.data.spaceReclaimed}`);
```

#### docker_pruneVolumes

Prune unused Docker volumes.

**Parameters**:

- `filter` (string, optional): Filter volumes based on conditions
- `force` (boolean, optional): Whether to force removal (default: false, not used as -f is always applied)
- `timeoutSeconds` (number, optional): Timeout in seconds (default: 60, max: 300)

**Note**: The `-f` flag is always used internally to avoid interactive prompts.

**Returns**: Object with `ok`, `exitCode`, `stdout`, `stderr`, `spaceReclaimed`, and `volumesDeleted` fields.

**Example**:

```typescript
import pruneVolumes from "@tokenring-ai/docker/tools/pruneVolumes";

const result = await pruneVolumes.execute(
  { filter: "dangling=true" },
  agent
);

console.log(`Space reclaimed: ${result.data.spaceReclaimed}`);
console.log(`Volumes deleted: ${result.data.volumesDeleted}`);
```

## Configuration

### DockerService Configuration

```typescript
const DockerConfigSchema = z.object({
  host: z.string().exactOptional(),
  tls: z.object({
    verify: z.boolean().default(false),
    caCert: z.string().exactOptional(),
    cert: z.string().exactOptional(),
    key: z.string().exactOptional(),
  }).exactOptional(),
  sandbox: z.boolean().exactOptional(),
});
```

**Configuration Options**:

- **host**: Docker daemon address (e.g., `unix:///var/run/docker.sock`, `tcp://remote:2375`)
- **tls.verify**: Enable TLS verification (default: false)
- **tls.caCert**: Path to CA certificate file
- **tls.cert**: Path to client certificate file
- **tls.key**: Path to client key file
- **sandbox**: Enable Docker sandbox provider registration (default: false)

### Environment Variables

The plugin automatically applies environment variables:

- **DOCKER_HOST**: Sets the Docker host if not configured
- **DOCKER_SANDBOX**: Enables sandbox provider if set
- **DOCKER_TLS_VERIFY**: Enables TLS verification if set
- **DOCKER_CERT_PATH**: Can be used to set TLS certificate paths

## Usage Examples

### 1. Ephemeral Container Execution

```typescript
import { Agent } from "@tokenring-ai/agent";
import dockerRun from "@tokenring-ai/docker/tools/dockerRun";

const agent = new Agent(registry);
const result = await dockerRun.execute({
  image: "ubuntu:22.04",
  cmd: "ls -la /usr/bin",
  timeoutSeconds: 30
}, agent);

if (result.data.ok) {
  console.log("Command output:", result.data.stdout);
} else {
  console.error("Error:", result.data.stderr);
}
```

### 2. Persistent Container Management

```typescript
import DockerSandboxProvider from "@tokenring-ai/docker/DockerSandboxProvider";
import DockerService from "@tokenring-ai/docker/DockerService";

const dockerService = new DockerService({});
const provider = new DockerSandboxProvider(dockerService);

// Create a persistent container
const { containerId } = await provider.createContainer({
  image: "node:18",
  environment: { NODE_ENV: "production" },
  workingDir: "/app"
});

// Execute multiple commands
const commands = [
  "bun install",
  "bun run build",
  "bun test"
];

for (const cmd of commands) {
  const result = await provider.executeCommand(containerId, cmd);
  console.log(`${cmd}:`, result.stdout);
}

// Clean up
await provider.stopContainer(containerId);
await provider.removeContainer(containerId);
```

### 3. Docker Image Operations

```typescript
import buildImage from "@tokenring-ai/docker/tools/buildImage";
import tagImage from "@tokenring-ai/docker/tools/tagImage";
import pushImage from "@tokenring-ai/docker/tools/pushImage";

// Build an image
const buildResult = await buildImage.execute({
  context: "./myapp",
  tag: "myapp:latest",
  dockerfile: "Dockerfile"
}, agent);

// Tag and push
await tagImage.execute({
  sourceImage: "myapp:latest",
  targetImage: "myregistry/myapp:v1.0"
}, agent);

await pushImage.execute({
  tag: "myregistry/myapp:v1.0"
}, agent);
```

### 4. Container Lifecycle Management

```typescript
import listContainers from "@tokenring-ai/docker/tools/listContainers";
import startContainer from "@tokenring-ai/docker/tools/startContainer";
import stopContainer from "@tokenring-ai/docker/tools/stopContainer";
import execInContainer from "@tokenring-ai/docker/tools/execInContainer";
import getContainerLogs from "@tokenring-ai/docker/tools/getContainerLogs";

// List running containers
const containers = await listContainers.execute({ all: false }, agent);

// Start a container
await startContainer.execute({ containers: ["my-container"] }, agent);

// Execute a command
const execResult = await execInContainer.execute({
  container: "my-container",
  commands: ["npm", "test"]
}, agent);

// Get logs
const logs = await getContainerLogs.execute({
  name: "my-container",
  tail: 50
}, agent);

// Stop the container
await stopContainer.execute({ containers: ["my-container"] }, agent);
```

## Plugin Integration

To use the Docker package with Token Ring, register the plugin in your application configuration:

```typescript
import {TokenRingApp} from "@tokenring-ai/app";
import dockerPlugin from "@tokenring-ai/docker/plugin";

const app = new TokenRingApp();

// Install the plugin with Docker configuration
await app.install(dockerPlugin, {
  docker: {
    host: "unix:///var/run/docker.sock",
    sandbox: true  // Enable sandbox provider
  }
});
```

Alternatively, register the services and tools manually:

```typescript
import {TokenRingApp} from "@tokenring-ai/app";
import {DockerService, DockerSandboxProvider} from "@tokenring-ai/docker";
import {SandboxService} from "@tokenring-ai/sandbox";
import {ChatService} from "@tokenring-ai/chat";
import tools from "@tokenring-ai/docker/tools";

const app = new TokenRingApp();

// Create and register the Docker service
const dockerService = new DockerService({
  host: "unix:///var/run/docker.sock"
});
app.addServices(dockerService);

// Register tools with ChatService
app.waitForService(ChatService, chatService => {
  chatService.addTools(...tools);
});

// Register DockerSandboxProvider with SandboxService (optional)
app.waitForService(SandboxService, sandboxService => {
  sandboxService.registerProvider("docker", new DockerSandboxProvider(dockerService));
});
```

## API Reference

### Public Exports

```typescript
// Main service and provider
export { default as DockerService } from "@tokenring-ai/docker/DockerService";
export { default as DockerSandboxProvider } from "@tokenring-ai/docker/DockerSandboxProvider";

// Configuration schema
export { DockerConfigSchema } from "@tokenring-ai/docker/schema";

// Types
export { DockerCommandResult } from "@tokenring-ai/docker/types";

// Plugin
export { default as dockerPlugin } from "@tokenring-ai/docker/plugin";

// Tools (import as a group)
import tools from "@tokenring-ai/docker/tools";

// Tools (import individually)
export { dockerRun } from "@tokenring-ai/docker/tools";
export { authenticateRegistry } from "@tokenring-ai/docker/tools";
export { buildImage } from "@tokenring-ai/docker/tools";
export { createNetwork } from "@tokenring-ai/docker/tools";
export { dockerStack } from "@tokenring-ai/docker/tools";
export { execInContainer } from "@tokenring-ai/docker/tools";
export { getContainerLogs } from "@tokenring-ai/docker/tools";
export { getContainerStats } from "@tokenring-ai/docker/tools";
export { listContainers } from "@tokenring-ai/docker/tools";
export { listImages } from "@tokenring-ai/docker/tools";
export { pruneImages } from "@tokenring-ai/docker/tools";
export { pruneVolumes } from "@tokenring-ai/docker/tools";
export { pushImage } from "@tokenring-ai/docker/tools";
export { removeContainer } from "@tokenring-ai/docker/tools";
export { removeImage } from "@tokenring-ai/docker/tools";
export { startContainer } from "@tokenring-ai/docker/tools";
export { stopContainer } from "@tokenring-ai/docker/tools";
export { tagImage } from "@tokenring-ai/docker/tools";
```

### DockerCommandResult Interface

```typescript
interface DockerCommandResult {
  ok?: boolean | undefined;
  exitCode?: number | undefined;
  stdout?: string | undefined;
  stderr?: string | undefined;
  error?: string | undefined;
}
```

### Tool Interface

All tools follow this pattern:

```typescript
interface TokenRingToolDefinition<T = z.ZodType> {
  name: string;                       // Tool name (e.g., "docker_dockerRun")
  displayName: string;                 // Display name (e.g., "Docker/dockerRun")
  description: string;                 // Tool description
  inputSchema: T;                      // Zod schema for input validation
  execute: (args: any, agent: Agent) => Promise<{ type: 'json', data: any }>;
}
```

## Package Structure

```text
pkg/docker/
├── index.ts                        # Main exports (DockerService, DockerSandboxProvider)
├── plugin.ts                       # TokenRing plugin integration
├── package.json                    # Package metadata and dependencies
├── schema.ts                       # Docker configuration schema
├── types.ts                        # Shared interfaces (DockerCommandResult)
├── DockerService.ts                # Core service for Docker configuration
├── DockerSandboxProvider.ts        # Sandbox implementation for persistent containers
├── tools.ts                        # Exported tools (all 19 tools)
└── tools/
    ├── dockerRun.ts                # Run ephemeral containers
    ├── listImages.ts               # List Docker images
    ├── buildImage.ts               # Build Docker images
    ├── listContainers.ts           # List Docker containers
    ├── getContainerLogs.ts         # Get container logs
    ├── getContainerStats.ts        # Get container statistics
    ├── startContainer.ts           # Start a container
    ├── stopContainer.ts            # Stop a container
    ├── removeContainer.ts          # Remove a container
    ├── removeImage.ts              # Remove an image
    ├── tagImage.ts                 # Tag an image
    ├── pushImage.ts                # Push an image to registry
    ├── createNetwork.ts            # Create a Docker network
    ├── dockerStack.ts              # Run Docker Compose stacks
    ├── execInContainer.ts          # Execute command in container
    ├── authenticateRegistry.ts     # Authenticate with Docker registry
    ├── pruneImages.ts              # Remove unused images
    └── pruneVolumes.ts             # Remove unused volumes
```

## Dependencies

The package has the following dependencies:

- `@tokenring-ai/app` (0.2.0) - Base application framework
- `@tokenring-ai/chat` (0.2.0) - Chat service integration
- `@tokenring-ai/agent` (0.2.0) - Agent orchestration
- `@tokenring-ai/sandbox` (0.2.0) - Sandbox provider interface
- `@tokenring-ai/utility` (0.2.0) - Shared utilities
- `@tokenring-ai/terminal` (0.2.0) - Terminal service for command execution
- `zod` (^4.3.6) - Schema validation
- `execa` (^9.6.1) - Process execution

### Dev Dependencies

- `vitest` (^4.1.1) - Testing framework
- `typescript` (^6.0.2) - TypeScript compiler

## Development and Testing

### Testing

The package uses vitest for testing:

```bash
bun test
```

### Build

```bash
bun run build
```

### Linting

```bash
bun run eslint
```

## Limitations and Considerations

- **Docker CLI Dependency**: Requires Docker CLI installed on the host system
- **Unix Socket Permissions**: Local Docker access requires appropriate user permissions
- **Network Access**: Remote Docker hosts require network connectivity
- **Error Handling**: Tools throw exceptions on failure; implement proper error handling in agent workflows
- **Security**: All commands are executed via shell; ensure proper input validation and sanitization
- **Resource Management**: Containers and images should be properly cleaned up to avoid resource exhaustion
- **TLS Configuration**: TLS verification requires proper certificate files to be accessible
- **Force Flags**: The `docker_pruneImages` and `docker_pruneVolumes` tools always use the `-f` flag internally to avoid
  interactive prompts
- **Timeout Limits**: Tools have maximum timeout limits to prevent indefinite execution
- **Shell Escaping**: All user-provided strings are shell-escaped for safety
- **Array Parameters**: Several tools (`startContainer`, `stopContainer`, `removeContainer`, `removeImage`,
  `getContainerStats`) require non-empty arrays for container/image identifiers

## License

MIT License - see [LICENSE](./LICENSE) file for details.
