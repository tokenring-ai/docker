import type { TokenRingService } from "@tokenring-ai/app/types";
import { shellEscape } from "@tokenring-ai/utility/string/shellEscape";
import type { z } from "zod";
import type { DockerConfigSchema } from "./schema.ts";

export default class DockerService implements TokenRingService {
  readonly name = "DockerService";
  description = "Provides Docker functionality";

  constructor(readonly options: z.output<typeof DockerConfigSchema>) {}

  buildDockerPrefixArgs(): string[] {
    const args: string[] = [];

    if (this.options.host) {
      args.push("-H", this.options.host);
    }

    if (this.options.tls?.verify) {
      args.push("--tls");
      const { caCert, cert, key } = this.options.tls;

      if (caCert) args.push(`--tlscacert=${caCert}`);
      if (cert) args.push(`--tlscert=${cert}`);
      if (key) args.push(`--tlskey=${key}`);
    }

    return args;
  }

  buildDockerCmd(): string {
    const prefixArgs = this.buildDockerPrefixArgs();
    if (prefixArgs.length === 0) {
      return "docker";
    }

    return `docker ${prefixArgs.map(arg => shellEscape(arg)).join(" ")}`;
  }
}
