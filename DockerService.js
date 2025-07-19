import { Service } from "@token-ring/registry";

export default class DockerService extends Service {
	name = "DockerService";
	description = "Provides Docker functionality";
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
	};

	constructor({
		host = "unix:///var/run/docker.sock",
		tlsVerify = false,
		tlsCACert,
		tlsCert,
		tlsKey,
	} = {}) {
		super();
		this.host = host;
		this.tlsVerify = tlsVerify;
		this.tlsCACert = tlsCACert;
		this.tlsCert = tlsCert;
		this.tlsKey = tlsKey;
		this.dirty = false;
	}

	getHost() {
		return this.host;
	}

	getTLSConfig() {
		return {
			tlsVerify: this.tlsVerify,
			tlsCACert: this.tlsCACert,
			tlsCert: this.tlsCert,
			tlsKey: this.tlsKey,
		};
	}
}
