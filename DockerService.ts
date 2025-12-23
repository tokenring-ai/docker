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
