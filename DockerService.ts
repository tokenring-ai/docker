import {TokenRingService} from "@tokenring-ai/app/types";
import {shellEscape} from "@tokenring-ai/utility/string/shellEscape";
import {z} from "zod";
import {DockerConfigSchema} from "./schema.ts";

export default class DockerService implements TokenRingService {
  name = "DockerService";
  description = "Provides Docker functionality";
  constructor(readonly options: z.output<typeof DockerConfigSchema>) {}

  buildDockerCmd(): string {
    let dockerCmd = "docker";

    if (this.options.host) {
      dockerCmd += ` -H ${shellEscape(this.options.host)}`;
    }

    if (this.options.tls?.verify) {
      dockerCmd += " --tls";
      const {caCert, cert, key} = this.options.tls;

      if (caCert) dockerCmd += ` --tlscacert=${shellEscape(caCert)}`;
      if (cert) dockerCmd += ` --tlscert=${shellEscape(cert)}`;
      if (key) dockerCmd += ` --tlskey=${shellEscape(key)}`;
    }

    return dockerCmd;
  }
}
