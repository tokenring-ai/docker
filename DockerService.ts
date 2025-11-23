import {TokenRingService} from "@tokenring-ai/app/types";

export interface DockerServiceParams {
  host?: string;
  tlsVerify?: boolean;
  tlsCACert?: string;
  tlsCert?: string;
  tlsKey?: string;
}

export interface TLSConfig {
  tlsVerify: boolean;
  tlsCACert?: string;
  tlsCert?: string;
  tlsKey?: string;
}

export default class DockerService implements TokenRingService {
  static constructorProperties = {
    host: {
      type: "string",
      required: false,
      description:
        "Docker host URL (e.g., tcp://remote-host:2375 or ssh://user@host). Defaults to unix:///var/run/docker.sock",
    },
    tlsVerify: {
      type: "boolean",
      required: false,
      description: "Whether to verify TLS certificates",
    },
    tlsCACert: {
      type: "string",
      required: false,
      description: "Path to CA certificate file",
    },
    tlsCert: {
      type: "string",
      required: false,
      description: "Path to client certificate file",
    },
    tlsKey: {
      type: "string",
      required: false,
      description: "Path to client key file",
    },
  } as const;
  name = "DockerService";
  description = "Provides Docker functionality";
  private readonly host: string;
  private readonly tlsVerify: boolean;
  private readonly tlsCACert?: string;
  private readonly tlsCert?: string;
  private readonly tlsKey?: string;
  private dirty: boolean;

  constructor({
                host = "unix:///var/run/docker.sock",
                tlsVerify = false,
                tlsCACert,
                tlsCert,
                tlsKey,
              }: DockerServiceParams = {}) {
    this.host = host;
    this.tlsVerify = tlsVerify;
    this.tlsCACert = tlsCACert;
    this.tlsCert = tlsCert;
    this.tlsKey = tlsKey;
    this.dirty = false;
  }

  getHost(): string {
    return this.host;
  }

  getTLSConfig(): TLSConfig {
    return {
      tlsVerify: this.tlsVerify,
      tlsCACert: this.tlsCACert,
      tlsCert: this.tlsCert,
      tlsKey: this.tlsKey,
    };
  }
}
