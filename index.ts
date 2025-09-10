import {TokenRingPackage} from "@tokenring-ai/agent";
import packageJSON from './package.json' with {type: 'json'};
import * as tools from "./tools.ts";

export {default as DockerService} from "./DockerService.ts";
export {default as DockerSandboxResource} from "./DockerSandboxProvider.ts";

export const packageInfo: TokenRingPackage = {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  tools
};
