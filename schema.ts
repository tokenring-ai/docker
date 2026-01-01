import {z} from "zod";

export const DockerConfigSchema = z.object({
  host: z.string().optional(),
  tls: z.object({
    verify: z.boolean().default(false),
    caCert: z.string().optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
  }).optional(),
});