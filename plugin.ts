import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {SandboxService} from "@tokenring-ai/sandbox";
import {SandboxServiceConfigSchema} from "@tokenring-ai/sandbox/schema";
import {z} from "zod";
import DockerSandboxProvider from "./DockerSandboxProvider.ts";
import DockerService from "./DockerService.ts";
import packageJSON from './package.json' with {type: 'json'};
import {DockerConfigSchema} from "./schema.ts";
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
