# @tokenring-ai/docker

A comprehensive Docker integration package for Token Ring AI agents, providing both ephemeral container execution and persistent container management capabilities.

## Overview

The `@tokenring-ai/docker` package enables AI agents to interact with Docker through a configurable service and a rich set of tools for common Docker operations. It supports local Docker via Unix socket, remote hosts via TCP or SSH, and optional TLS configuration for secure connections.

### Key Features

- **Ephemeral Container Execution**: Run one-off commands in temporary containers using the `dockerRun` tool
- **Persistent Container Management**: Create, manage, and execute commands in long-running containers via `DockerSandboxProvider`
- **Comprehensive Tool Suite**: 18+ tools covering image building, container management, resource listing, logging, and more
- **Secure CLI Execution**: All operations use `execa` for secure command execution with proper timeout handling
- **Flexible Configuration**: Support for custom Docker hosts, TLS certificates, and connection parameters
- **Agent Integration**: Seamless integration with Token Ring's agent ecosystem and service architecture

## Installation

```bash
npm install @tokenring-ai/docker
```

## Dependencies

- **Peer Dependencies**:
  - `@tokenring-ai/agent` ^0.1.0
  - `@tokenring-ai/filesystem` ^0.1.0
  - `@tokenring-ai/sandbox` ^0.1.0
  - `@tokenring-ai/utility` ^0.1.0
- **Runtime Dependencies**:
  - `execa` ^9.6.0
  - `glob-gitignore` ^1.0.15
- **External Requirements**: Docker CLI must be installed and accessible on the host machine

## Setup and Configuration

### 1. Service Registration

```typescript
import { ServiceRegistry } from "@tokenring-ai/registry";
import { DockerService } from "@tokenring-ai/docker";
import { FileSystemService } from "@tokenring-ai/filesystem";

const registry = new ServiceRegistry();

// Register required services
registry.registerService(new FileSystemService({ 
  baseDirectory: process.cwd() 
}));

registry.registerService(new DockerService({
  host: "unix:///var/run/docker.sock", // Default
  tlsVerify: false, // Optional TLS
  tlsCACert: "/path/to/ca.crt", // Optional
  tlsCert: "/path/to/client.crt", // Optional
  tlsKey: "/path/to/client.key" // Optional
}));
```

### 2. Plugin Integration

The package can also be used as a Token Ring plugin:

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import dockerPlugin from "@tokenring-ai/docker";

const app = new TokenRingApp();
app.use(dockerPlugin);
```

## Package Structure

```
pkg/docker/
├── index.ts              # Main exports and plugin definition
├── package.json          # Package metadata and dependencies
├── tsconfig.json         # TypeScript configuration
├── types.ts              # Shared interfaces (TLSConfig, DockerCommandResult)
├── DockerService.ts      # Core service for Docker configuration
├── DockerSandboxProvider.ts # Sandbox implementation for persistent containers
├── tools.ts              # Re-exports all available tools
├── tools/                # Individual tool modules (18+ tools)
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
│   ├── tagImage.ts       # Tag images
│   ├── pruneImages.ts    # Prune unused images
│   ├── pruneVolumes.ts   # Prune unused volumes
│   ├── createNetwork.ts  # Create Docker networks
│   ├── dockerStack.ts    # Manage Docker stacks
│   └── authenticateRegistry.ts # Authenticate with registries
└── README.md             # This documentation
├── LICENSE               # MIT License
```

## Core Components

### DockerService

**Description**: A Token Ring service that configures Docker connection parameters. It provides host and TLS settings to all Docker operations.

**Constructor Parameters**:
```typescript
interface DockerServiceParams {
  host?: string; // Default: "unix:///var/run/docker.sock"
  tlsVerify?: boolean; // Default: false
  tlsCACert?: string;
  tlsCert?: string;
  tlsKey?: string;
}
```

**Key Methods**:
- `getHost(): string` - Returns the configured Docker host
- `getTLSConfig(): TLSConfig` - Returns TLS configuration object

### DockerSandboxProvider

**Description**: Extends `@tokenring-ai/sandbox/SandboxProvider` to manage persistent Docker containers.

**Key Methods**:
- `createContainer(options: SandboxOptions): Promise<SandboxResult>`
- `executeCommand(containerId: string, command: string): Promise<ExecuteResult>`
- `stopContainer(containerId: string): Promise<void>`
- `getLogs(containerId: string): Promise<LogsResult>`
- `removeContainer(containerId: string): Promise<void>`

**Example Usage**:
```typescript
import { DockerSandboxProvider } from "@tokenring-ai/docker";

const provider = new DockerSandboxProvider({
  host: "tcp://remote:2375",
  tlsVerify: true
});

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
```

## Available Tools

### Container Management
- **dockerRun**: Execute commands in ephemeral containers
- **startContainer**: Start one or more containers
- **stopContainer**: Stop one or more containers
- **removeContainer**: Remove one or more containers

### Image Management
- **buildImage**: Build images from Dockerfile
- **listImages**: List Docker images with filtering and formatting
- **pushImage**: Push images to registries
- **tagImage**: Tag images with new names
- **pruneImages**: Prune unused images

### Container Operations
- **listContainers**: List containers with filtering and formatting
- **getContainerLogs**: Retrieve container logs with various options
- **getContainerStats**: Get container statistics
- **execInContainer**: Execute commands in running containers

### Network and Volume Management
- **createNetwork**: Create Docker networks
- **pruneVolumes**: Prune unused volumes

### Advanced Operations
- **dockerStack**: Manage Docker stacks (deploy, remove, ps)
- **authenticateRegistry**: Authenticate with Docker registries

## Usage Examples

### 1. Ephemeral Container Execution

```typescript
import { Agent } from "@tokenring-ai/agent";
import { dockerRun } from "@tokenring-ai/docker/tools";

const agent = new Agent(registry);
const result = await dockerRun.execute({
  image: "ubuntu:22.04",
  cmd: "ls -la /usr/bin",
  workdir: "/tmp",
  timeoutSeconds: 30,
  mountSrc: "/host-src" // Mounts filesystem base directory
}, agent);

if (result.ok) {
  console.log("Command output:", result.stdout);
} else {
  console.error("Error:", result.stderr);
}
```

### 2. Image Building and Pushing

```typescript
import { buildImage, pushImage } from "@tokenring-ai/docker/tools";

// Build the image
const buildResult = await buildImage.execute({
  context: "./myapp",
  tag: "myrepo/myapp:v1.0.0",
  dockerfile: "Dockerfile",
  buildArgs: { NODE_VERSION: "18" },
  noCache: true,
  timeoutSeconds: 600
}, agent);

if (buildResult.ok) {
  // Push to registry
  const pushResult = await pushImage.execute({
    tag: "myrepo/myapp:v1.0.0",
    timeoutSeconds: 300
  }, agent);
  
  console.log("Image pushed successfully");
}
```

### 3. Container Lifecycle Management

```typescript
import { listContainers, startContainer, stopContainer } from "@tokenring-ai/docker/tools";

// List all containers
const containers = await listContainers.execute({
  all: true,
  format: "json"
}, agent);

// Start stopped containers
for (const container of containers.containers || []) {
  await startContainer.execute({
    containers: container.Id,
    timeoutSeconds: 30
  }, agent);
}

// Stop running containers
await stopContainer.execute({
  containers: containers.containers?.map(c => c.Id) || [],
  timeoutSeconds: 30
}, agent);
```

### 4. Persistent Container Management

```typescript
import { DockerSandboxProvider } from "@tokenring-ai/docker";

const provider = new DockerSandboxProvider();

// Create a persistent container
const { containerId } = await provider.createContainer({
  image: "node:18",
  environment: { NODE_ENV: "production" },
  workingDir: "/app"
});

// Execute multiple commands
const commands = [
  "npm install",
  "npm run build",
  "npm test"
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
- **host**: Docker daemon address (default: unix socket)
- **tlsVerify**: Enable TLS verification (default: false)
- **tlsCACert**: Path to CA certificate file
- **tlsCert**: Path to client certificate file
- **tlsKey**: Path to client key file

### Tool-Specific Configuration
- **Timeouts**: Automatically clamped (5-600s for most operations, up to 1800s for builds)
- **Output Formats**: JSON for structured data, table for human-readable output
- **Mounts**: Support for host directory mounting via `FileSystemService`
- **Filters**: Advanced filtering for lists and operations

## API Reference

### Public Exports

```typescript
// Main service and provider
export { default as DockerService } from "./DockerService.ts";
export { default as DockerSandboxProvider } from "./DockerSandboxProvider.ts";

// All tools
export * from "./tools.ts";

// Types
export { TLSConfig, DockerCommandResult } from "./types.ts";
```

### Tool Interface

All tools follow this pattern:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodSchema;
  execute: (args: any, agent: Agent) => Promise<DockerCommandResult>;
}
```

### Common Result Types

```typescript
interface DockerCommandResult {
  ok?: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

interface TLSConfig {
  tlsVerify: boolean;
  tlsCACert?: string;
  tlsCert?: string;
  tlsKey?: string;
}
```

## Development and Testing

### Build and Lint

```bash
# Run ESLint
npm run eslint

# No specific build step - TypeScript compiles on import
```

### Testing

The package is designed to be tested through integration with the Token Ring agent ecosystem. Use tools like `listContainers` to verify functionality:

```typescript
import { listContainers } from "@tokenring-ai/docker/tools";

const result = await listContainers.execute({ all: true }, agent);
console.log("Available containers:", result.containers);
```

## Limitations and Considerations

- **Docker CLI Dependency**: Requires Docker CLI installed on the host system
- **Unix Socket Permissions**: Local Docker access requires appropriate user permissions
- **Network Access**: Remote Docker hosts require network connectivity
- **Buffer Limits**: Large outputs may hit `maxBuffer` limits (configurable per tool)
- **Error Handling**: Tools throw exceptions on failure; implement proper error handling in agent workflows
- **Security**: All commands are executed via shell; ensure proper input validation and sanitization

## Best Practices

1. **Use Ephemeral Containers**: For isolated, one-off operations
2. **Persistent Containers**: For stateful, long-running tasks
3. **Input Validation**: Leverage Zod schemas for all tool inputs
4. **Timeout Management**: Set appropriate timeouts for operations
5. **Error Handling**: Implement comprehensive error handling in agent workflows
6. **Resource Management**: Clean up resources after use to prevent leaks

## License

MIT License - see LICENSE file for details.

## Version

0.1.0 - Early development stage; APIs may evolve.