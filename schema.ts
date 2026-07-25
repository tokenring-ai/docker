import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { fromEnv, sourcedValue } from "@tokenring-ai/secrets/secret";
import { z } from "zod";

export const DockerConfigSchema = z.object({
  host: sourcedValue({ description: "Docker daemon host (e.g. tcp://localhost:2376)" } satisfies ConfigFieldMeta).default(fromEnv("DOCKER_HOST")),
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
    .default(true)
    .meta({ description: "Registers this docker instance as a sandbox environment" } satisfies ConfigFieldMeta),
});

export type DockerConfig = z.output<typeof DockerConfigSchema>;

/** Config as handed to the service, with the daemon host already resolved. */
export type ResolvedDockerConfig = Omit<DockerConfig, "host"> & { host?: string | undefined };
