# @tokenring-ai/docker

Docker integration package for Token Ring AI agents, providing both ephemeral container execution and persistent container management capabilities.

## Overview

The `@tokenring-ai/docker` package enables AI agents to interact with Docker through a configurable service and a set of tools for Docker operations. It supports local Docker via Unix socket, remote hosts via TCP or SSH, and optional TLS configuration for secure connections.

### Key Features

- **Ephemeral Container Execution**: Run one-off commands in temporary containers using the `dockerRun` tool
- **Persistent Container Management**: Create, manage, and execute commands in long-running containers via `DockerSandboxProvider`
- **Secure Configuration**: Service-based Docker configuration with TLS support
- **Agent Integration**: Seamless integration with Token Ring's agent ecosystem and service architecture
- **Shell Safety**: All operations use proper shell escaping and timeout management

## Installation

```bash
npm install @tokenring-ai/docker
```

## Dependencies

- **Peer Dependencies**:
  - `@tokenring-ai/app` ^0.2.0
  - `@tokenring-ai/chat` ^0.2.0
  - `@tokenring-ai/agent` ^0.2.0
  - `@tokenring-ai/filesystem` ^0.2.0
  - `@tokenring-ai/sandbox` ^0.2.0
  - `@tokenring-ai/utility` ^0.2.0
- **Runtime Dependencies**:
  - `execa` ^9.6.1
  - `zod` (catalog)
  - `glob-gitignore` ^1.0.15
- **External Requirements**: Docker CLI must be installed and accessible on the host machine

## Setup and Configuration

### Plugin Integration (Recommended)

The package integrates as a Token Ring plugin:

```typescript
import { TokenRingApp } from "@tokenring-ai/app";
import dockerPlugin from "@tokenring-ai/docker";

const app = new TokenRingApp();
app.use(dockerPlugin);
```

### Service Registration

Alternatively, register the service directly:

```typescript
import { ServiceRegistry } from "@tokenring-ai/registry";
import { DockerService } from "@tokenring-ai/docker";

const registry = new ServiceRegistry();

registry.registerService(new DockerService({
  host: "unix:///var/run/docker.sock", // Default
  tlsVerify: false, // Optional TLS
  tlsCACert: "/path/to/ca.crt", // Optional
  tlsCert: "/path/to/client.crt", // Optional
  tlsKey: "/path/to/client.key" // Optional
}));
```

## Package Structure

```
pkg/docker/
├── index.ts                    # Main exports and DockerConfigSchema
├── plugin.ts                   # TokenRing plugin integration
├── package.json               # Package metadata and dependencies
├── types.ts                   # Shared interfaces (TLSConfig, DockerCommandResult)
├── DockerService.ts           # Core service for Docker configuration
├── DockerSandboxProvider.ts   # Sandbox implementation for persistent containers
├── tools.ts                   # Re-exports available tools
├── tools/                     # Individual tool modules
│   ├── dockerRun.ts           # Run ephemeral containers
│   ├── listContainers.ts      # List Docker containers
│   ├── buildImage.ts          # Build images from Dockerfile
│   ├── execInContainer.ts     # Execute commands in running containers
│   ├── listImages.ts          # List Docker images
│   ├── getContainerLogs.ts    # Retrieve container logs
│   ├── getContainerStats.ts   # Get container statistics
│   ├── startContainer.ts      # Start stopped containers
│   ├── stopContainer.ts       # Stop running containers
│   ├── removeContainer.ts     # Remove containers
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

**Properties**:
- `name = "DockerService"` - Service identifier
- `description = "Provides Docker functionality"` - Service description
- `static constructorProperties` - Schema for service registration

### DockerSandboxProvider

**Description**: Extends `@tokenring-ai/sandbox/SandboxProvider` to manage persistent Docker containers.

**Constructor Parameters**:
```typescript
interface DockerSandboxProviderParams extends TLSConfig {
  host?: string;
  tlsVerify?: boolean;
  tlsCACert?: string;
  tlsCert?: string;
  tlsKey?: string;
}
```

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

### Core Tools (Currently Implemented)

- **dockerRun**: Execute commands in ephemeral containers (automatically cleaned up)
- **listContainers**: List Docker containers with filtering and formatting options
- **buildImage**: Build Docker images from Dockerfile with build arguments
- **execInContainer**: Execute commands in running containers with environment and working directory options

### Extended Tool Suite (Available via tools directory)

- **Image Management**: `buildImage`, `listImages`, `pushImage`, `tagImage`, `pruneImages`
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
export const DockerConfigSchema = z.any().optional();

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

## Plugin Integration

The package automatically integrates with Token Ring applications:

```typescript
// In plugin.ts
export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app: TokenRingApp) {
    const config = app.getConfigSlice('docker', DockerConfigSchema);
    if (config) {
      app.waitForService(ChatService, chatService =>
        chatService.addTools(packageJSON.name, tools)
      );
      app.addServices(new DockerService(config));
    }
  }
} satisfies TokenRingPlugin;
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

0.2.0 - Added plugin integration and comprehensive Docker tool suite.