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
  install(app) {
    const dockerService = app.addService(new DockerService());

    app.waitForService(ChatService, chatService => chatService.addTools(tools));
    app.waitForService(SandboxService, sandboxService => {
      sandboxService.registerProvider("docker", new DockerSandboxProvider(dockerService));
    });
  },
  reconfigure(app, config) {
    const { host: hostRef, ...dockerConfig } = config.docker;
    const host = resolveSecret(app, hostRef);
    app.requireService(DockerService).reconfigure({ ...dockerConfig, ...(host !== undefined && { host }) });
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
