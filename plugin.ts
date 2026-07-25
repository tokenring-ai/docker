import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { SandboxService } from "@tokenring-ai/sandbox";
import { resolveSecret } from "@tokenring-ai/secrets/SecretService";
import { z } from "zod";
import DockerSandboxProvider from "./DockerSandboxProvider.ts";
import DockerService from "./DockerService.ts";
import packageJSON from "./package.json" with { type: "json" };
import { DockerConfigSchema } from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  docker: DockerConfigSchema.prefault({}),
});

export default {
  name: packageJSON.name,
  displayName: "Docker Integration",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.waitForService(ChatService, chatService => chatService.addTools(...tools));

    const { host: hostRef, ...dockerConfig } = config.docker;
    const host = resolveSecret(app, hostRef);
    const dockerService = new DockerService({ ...dockerConfig, ...(host !== undefined && { host }) });
    app.addServices(dockerService);

    if (config.docker.sandbox) {
      app.waitForService(SandboxService, sandboxService => {
        sandboxService.registerProvider("docker", new DockerSandboxProvider(dockerService));
      });
    }
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
