# @tokenring-ai/docker

Docker integration package for Token Ring AI agents, providing both ephemeral container execution and persistent container management capabilities.

## Overview

The `@tokenring-ai/docker` package enables AI agents to interact with Docker through a configurable service and a set of tools for Docker operations. It supports local Docker via Unix socket, remote hosts via TCP, and optional TLS configuration for secure connections.

### Key Features

- **Ephemeral Container Execution**: Run one-off commands in temporary containers using the `dockerRun` tool
- **Persistent Container Management**: Create, manage, and execute commands in long-running containers via `DockerSandboxProvider`
- **Secure Configuration**: Service-based Docker configuration with TLS support
- **Agent Integration**: Seamless integration with Token Ring's agent ecosystem and service architecture
- **Shell Safety**: All operations use proper shell escaping and timeout management

## Installation

```bash
bun install @tokenring-ai/docker
```

## Setup and Configuration

### Service Registration

Alternatively, register the service directly:

```typescript
import { DockerService, DockerSandboxProvider } from "@tokenring-ai/docker";
import { SandboxService } from "@tokenring-ai/sandbox";

const dockerService = new DockerService({
  host: "unix:///var/run/docker.sock",
});

app.addServices(dockerService);

app.waitForService(SandboxService, sandboxService => {
  sandboxService.registerProvider("docker", new DockerSandboxProvider(dockerService));
});
```

## Package Structure

```
pkg/docker/
├── index.ts                    # Main exports (DockerService, DockerSandboxProvider)
├── plugin.ts                   # TokenRing plugin integration
├── package.json               # Package metadata and dependencies
├── schema.ts                  # Docker configuration schema
├── types.ts                   # Shared interfaces (DockerCommandResult)
├── DockerService.ts           # Core service for Docker configuration
├── DockerSandboxProvider.ts   # Sandbox implementation for persistent containers
├── tools.ts                   # Re-exports available tools
├── tools/                     # Individual tool modules
│   ├── dockerRun.ts           # Run ephemeral containers (currently exported)
│   ├── listContainers.ts      # List Docker containers
│   ├── buildImage.ts          # Build images from Dockerfile
│   ├── execInContainer.ts     # Execute commands in running containers
│   ├── listImages.ts          # List Docker images
│   ├── getContainerLogs.ts    # Retrieve container logs
│   ├── getContainerStats.ts   # Get container statistics
│   ├── startContainer.ts      # Start stopped containers
│   ├── stopContainer.ts       # Stop running containers
│   ├── removeContainer.ts     # Remove containers
│   ├── removeImage.ts         # Remove Docker images
│   ├── pushImage.ts           # Push images to registry
│   ├── tagImage.ts            # Tag images
│   ├── pruneImages.ts         # Prune unused images
│   ├── pruneVolumes.ts        # Prune unused volumes
│   ├── createNetwork.ts       # Create Docker networks
│   ├── dockerStack.ts         # Manage Docker stacks
│   └── authenticateRegistry.ts # Authenticate with registries
└── README.md                  # This documentation
```

## Core Components

### DockerService

**Description**: A Token Ring service that configures Docker connection parameters. It builds Docker CLI commands with proper host and TLS settings.

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
import DockerService from "./DockerService.ts";

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
// Returns: "docker --tls --tlscacert=/path/to/ca.crt --tlscert=/path/to/client.crt --tlskey=/path/to/client.key"
```

### DockerSandboxProvider

**Description**: Implements `SandboxProvider` to manage persistent Docker containers. Creates detached containers that can execute multiple commands over time.

**Constructor Parameters**:

```typescript
constructor(readonly dockerService: DockerService) {}
```

**Key Methods**:

- `createContainer(options: SandboxOptions): Promise<SandboxResult>` - Create a new persistent container
- `executeCommand(containerId: string, command: string): Promise<ExecuteResult>` - Execute a command in a running container
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
import DockerSandboxProvider from "./DockerSandboxProvider.ts";
import DockerService from "./DockerService.ts";

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

## Available Tools

### Currently Exported Tools

- **dockerRun**: Execute commands in ephemeral containers (currently the only tool exported via tools.ts)

### Available Tools (Not Currently Exported)

The tools directory contains additional Docker operations that can be extended:

- **Image Management**: `buildImage`, `listImages`, `pushImage`, `tagImage`, `pruneImages`, `removeImage`
- **Container Management**: `listContainers`, `startContainer`, `stopContainer`, `removeContainer`
- **Container Operations**: `execInContainer`, `getContainerLogs`, `getContainerStats`
- **Resource Management**: `pruneVolumes`, `createNetwork`
- **Advanced Operations**: `dockerStack`, `authenticateRegistry`

## Usage Examples

### 1. Ephemeral Container Execution

```typescript
import { Agent } from "@tokenring-ai/agent";
import { dockerRun } from "@tokenring-ai/docker/tools";

const agent = new Agent(registry);
const result = await dockerRun.execute({
  image: "ubuntu:22.04",
  cmd: "ls -la /usr/bin",
  timeoutSeconds: 30
}, agent);

if (result.ok) {
  console.log("Command output:", result.stdout);
} else {
  console.error("Error:", result.stderr);
}
```

### 2. Container Management

```typescript
import { listContainers, execInContainer } from "@tokenring-ai/docker/tools";

// List all containers
const containers = await listContainers.execute({
  all: true,
  format: "json"
}, agent);

// Execute command in a running container
if (containers.containers && containers.containers.length > 0) {
  const containerId = containers.containers[0].Id;
  const result = await execInContainer.execute({
    container: containerId,
    command: "cat /etc/os-release",
    timeoutSeconds: 30
  }, agent);

  console.log(result.stdout);
}
```

### 3. Image Building

```typescript
import { buildImage } from "@tokenring-ai/docker/tools";

const result = await buildImage.execute({
  context: "./myapp",
  tag: "myrepo/myapp:v1.0.0",
  dockerfile: "Dockerfile",
  buildArgs: { NODE_VERSION: "18" },
  noCache: true,
  timeoutSeconds: 600
}, agent);

if (result.ok) {
  console.log("Image built successfully:", result.tag);
}
```

### 4. Persistent Container Management

```typescript
import { DockerSandboxProvider } from "@tokenring-ai/docker";

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

## Configuration Options

### DockerService Configuration

```typescript
const DockerConfigSchema = z.object({
  host: z.string().optional(),
  tls: z.object({
    verify: z.boolean().default(false),
    caCert: z.string().optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
  }).optional(),
});
```

**Configuration Options**:

- **host**: Docker daemon address (e.g., `unix:///var/run/docker.sock`, `tcp://remote:2375`)
- **tls.verify**: Enable TLS verification (default: false)
- **tls.caCert**: Path to CA certificate file
- **tls.cert**: Path to client certificate file
- **tls.key**: Path to client key file

### Plugin Configuration

```typescript
const packageConfigSchema = z.object({
  docker: DockerConfigSchema.optional(),
  sandbox: SandboxServiceConfigSchema.optional(),
});
```

### Tool-Specific Configuration

- **Timeouts**: Automatically clamped per tool (5-600s for most operations, up to 1800s for builds)
- **Output Formats**: JSON for structured data, table for human-readable output
- **Shell Escaping**: Automatic shell escaping for all command arguments
- **Buffer Management**: Configurable maxBuffer sizes per operation

## API Reference

### Public Exports

```typescript
// Main service and provider
export { default as DockerService } from "./DockerService.ts";
export { default as DockerSandboxProvider } from "./DockerSandboxProvider.ts";

// Configuration schema
export { DockerConfigSchema } from "./schema.ts";

// Currently exported tools
export default from "./tools.ts";

// Types
export { DockerCommandResult } from "./types.ts";
```

### DockerCommandResult Interface

```typescript
interface DockerCommandResult {
  ok?: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}
```

### Tool Interface

All tools follow this pattern:

```typescript
interface TokenRingToolDefinition<T = z.ZodType> {
  name: string;                    // Tool name (e.g., "docker_dockerRun")
  description: string;            // Tool description
  inputSchema: T;                 // Zod schema for input validation
  execute: (args: any, agent: Agent) => Promise<DockerCommandResult>;
}
```

## Plugin Integration

The package automatically integrates with Token Ring applications:

```typescript
// In plugin.ts
import { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { SandboxService } from "@tokenring-ai/sandbox";
import { SandboxServiceConfigSchema } from "@tokenring-ai/sandbox/schema";
import { z } from "zod";
import DockerSandboxProvider from "./DockerSandboxProvider.ts";
import DockerService from "./DockerService.ts";
import packageJSON from './package.json' with {type: 'json'};
import { DockerConfigSchema } from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  docker: DockerConfigSchema.optional(),
  sandbox: SandboxServiceConfigSchema.optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (! config.docker) return;
    app.waitForService(ChatService, chatService =>
      chatService.addTools(packageJSON.name, tools)
    );
    const dockerService = new DockerService(config.docker);
    app.addServices(dockerService);

    if (config.sandbox) {
      app.waitForService(SandboxService, sandboxService => {
        for (const name in config.sandbox!.providers) {
          const provider = config.sandbox!.providers[name];
          if (provider.type === "docker") {
            sandboxService.registerProvider(name, new DockerSandboxProvider(dockerService));
          }
        }
      });
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

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
- **Buffer Limits**: Large outputs may hit `maxBuffer` limits (configurable per tool)
- **Error Handling**: Tools throw exceptions on failure; implement proper error handling in agent workflows
- **Security**: All commands are executed via shell; ensure proper input validation and sanitization
- **JavaScript Tools**: Some tools are written in JavaScript and may need to be migrated to TypeScript

## License

MIT License - see [LICENSE](./LICENSE) file for details.
