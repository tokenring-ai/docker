// Import all implemented tools
// Import all implemented tools
import authenticateRegistry from "./tools/authenticateRegistry.ts";
import buildImage from "./tools/buildImage.ts";
import createNetwork from "./tools/createNetwork.ts";
import dockerRun from "./tools/dockerRun.ts";
import dockerStack from "./tools/dockerStack.ts";
import execInContainer from "./tools/execInContainer.ts";
import getContainerLogs from "./tools/getContainerLogs.ts";
import getContainerStats from "./tools/getContainerStats.ts";
import listContainers from "./tools/listContainers.ts";
import listImages from "./tools/listImages.ts";
import pruneImages from "./tools/pruneImages.ts";
import pruneVolumes from "./tools/pruneVolumes.ts";
import pushImage from "./tools/pushImage.ts";
import removeContainer from "./tools/removeContainer.ts";
import removeImage from "./tools/removeImage.ts";
import startContainer from "./tools/startContainer.ts";
import stopContainer from "./tools/stopContainer.ts";
import tagImage from "./tools/tagImage.ts";

export default {
  dockerRun,
  authenticateRegistry,
  buildImage,
  createNetwork,
  dockerStack,
  execInContainer,
  getContainerLogs,
  getContainerStats,
  listContainers,
  listImages,
  pruneImages,
  pruneVolumes,
  pushImage,
  removeContainer,
  removeImage,
  startContainer,
  stopContainer,
  tagImage,
};

// Export individual tools for direct import
export {dockerRun};
export {authenticateRegistry};
export {buildImage};
export {createNetwork};
export {dockerStack};
export {execInContainer};
export {getContainerLogs};
export {getContainerStats};
export {listContainers};
export {listImages};
export {pruneImages};
export {pruneVolumes};
export {pushImage};
export {removeContainer};
export {removeImage};
export {startContainer};
export {stopContainer};
export {tagImage};
