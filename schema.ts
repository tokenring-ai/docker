import { z } from "zod";

export const DockerConfigSchema = z.object({
  host: z.string().exactOptional(),
  tls: z
    .object({
      verify: z.boolean().default(false),
      caCert: z.string().exactOptional(),
      cert: z.string().exactOptional(),
      key: z.string().exactOptional(),
    })
    .exactOptional(),
  sandbox: z.boolean().exactOptional(),
});

export type DockerConfig = z.output<typeof DockerConfigSchema>;
