import type {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {SandboxService} from "@tokenring-ai/sandbox";
import {z} from "zod";
import DockerSandboxProvider from "./DockerSandboxProvider.ts";
import DockerService from "./DockerService.ts";
import packageJSON from "./package.json" with {type: "json"};
import {DockerConfigSchema} from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  docker: DockerConfigSchema.prefault({}),
});

function applyEnv(config: z.input<typeof DockerConfigSchema>): void {
  if (process.env.DOCKER_HOST) config.host ??= process.env.DOCKER_HOST;
  if (process.env.DOCKER_SANDBOX) config.sandbox ??= true;
  if (process.env.DOCKER_TLS_VERIFY || process.env.DOCKER_CERT_PATH) {
    config.tls ??= {verify: !!process.env.DOCKER_TLS_VERIFY};
  }
}

export default {
  name: packageJSON.name,
  displayName: "Docker Integration",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    applyEnv(config.docker);

    app.waitForService(ChatService, (chatService) =>
      chatService.addTools(...tools),
    );

    const dockerService = new DockerService(
      DockerConfigSchema.parse(config.docker),
    );
    app.addServices(dockerService);

    if (config.docker.sandbox) {
      app.waitForService(SandboxService, (sandboxService) => {
        sandboxService.registerProvider(
          "docker",
          new DockerSandboxProvider(dockerService),
        );
      });
    }
  },
  config: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
