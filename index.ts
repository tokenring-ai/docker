import {AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
import {z} from "zod";
import DockerService from "./DockerService.ts";
import packageJSON from './package.json' with {type: 'json'};
import * as tools from "./tools.ts";

export const DockerConfigSchema = z.any().optional();

export const packageInfo: TokenRingPackage = {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(agentTeam: AgentTeam) {
    const config = agentTeam.getConfigSlice('docker', DockerConfigSchema);
    if (config) {
      agentTeam.addTools(packageInfo, tools);
      agentTeam.addServices(new DockerService(config));
    }
  }
};

export {default as DockerService} from "./DockerService.ts";
export {default as DockerSandboxProvider} from "./DockerSandboxProvider.ts";
