import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { z } from "zod";

export const DockerConfigSchema = z.object({
  host: z
    .string()
    .exactOptional()
    .meta({ description: "Docker daemon host (e.g. tcp://localhost:2376)" } satisfies ConfigFieldMeta),
  tls: z
    .object({
      verify: z
        .boolean()
        .default(false)
        .meta({ description: "Verify the Docker daemon's TLS certificate" } satisfies ConfigFieldMeta),
      caCert: z
        .string()
        .exactOptional()
        .meta({ description: "CA certificate (PEM)", uiType: "multilineText" } satisfies ConfigFieldMeta),
      cert: z
        .string()
        .exactOptional()
        .meta({ description: "Client certificate (PEM)", uiType: "multilineText" } satisfies ConfigFieldMeta),
      key: z
        .string()
        .exactOptional()
        .meta({ sensitive: true, description: "Client private key (PEM)" } satisfies ConfigFieldMeta),
    })
    .exactOptional()
    .meta({ label: "TLS", advanced: true } satisfies ConfigFieldMeta),
  sandbox: z
    .boolean()
    .exactOptional()
    .meta({ description: "Run containers with sandboxing restrictions" } satisfies ConfigFieldMeta),
});

export type DockerConfig = z.output<typeof DockerConfigSchema>;
