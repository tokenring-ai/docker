import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { ToolCallError } from "@tokenring-ai/chat/util/tokenRingTool";
import { TerminalService } from "@tokenring-ai/terminal";
import type { ExecuteCommandResult } from "@tokenring-ai/terminal/TerminalProvider";
import type DockerService from "../DockerService.ts";

export function clampTimeout(timeoutSeconds: number, min: number, max: number): number {
  return Math.max(min, Math.min(timeoutSeconds, max));
}

export function formatDockerCommandOutput(summary: string, contextLines: string[], exitCode: number, output: string): string {
  const context = contextLines.length > 0 ? `${contextLines.join("\n")}\n` : "";
  return `${summary}:\n
${context}Exit code: ${exitCode}
---Output---
${output.trim()}
---End Output---`;
}

function getCommandResult(result: ExecuteCommandResult): { exitCode: number; output: string } {
  switch (result.status) {
    case "success":
      return { exitCode: 0, output: result.output };
    case "badExitCode":
      return { exitCode: result.exitCode, output: result.output };
    case "timeout":
      return { exitCode: 124, output: result.output || "Command timed out" };
    case "unknownError":
      return { exitCode: 1, output: result.error };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export type ExecuteDockerCommandOptions = {
  toolName: string;
  /** Markdown message with bolded intent, e.g. `**Listed** containers` */
  message: string;
  /** Label included at the start of the result text sent to the LLM */
  resultLabel: string;
  dockerArgs: string[];
  timeoutSeconds: number;
  minTimeout?: number;
  maxTimeout?: number;
  contextLines?: string[];
  logCommand?: string;
  errorMessage?: string;
};

export async function executeDockerCommand(dockerService: DockerService, agent: Agent, options: ExecuteDockerCommandOptions): Promise<TokenRingToolResult> {
  const terminal = agent.requireServiceByType(TerminalService);
  const minTimeout = options.minTimeout ?? 5;
  const maxTimeout = options.maxTimeout ?? 120;
  const timeout = clampTimeout(options.timeoutSeconds, minTimeout, maxTimeout);
  const commandArgs = ["timeout", `${timeout}s`, "docker", ...dockerService.buildDockerPrefixArgs(), ...options.dockerArgs];

  agent.infoMessage(`[${options.toolName}] Executing: ${options.logCommand ?? commandArgs.join(" ")}`);

  try {
    const result = await terminal.executeCommand(commandArgs[0]!, commandArgs.slice(1), { timeoutSeconds: timeout }, agent);
    const { exitCode, output } = getCommandResult(result);

    if (result.status === "timeout" || result.status === "unknownError") {
      throw new ToolCallError(options.toolName, options.errorMessage ?? "Error executing Docker command", {
        cause: new Error(output),
      });
    }

    return {
      message: options.message,
      result: formatDockerCommandOutput(options.resultLabel, options.contextLines ?? [], exitCode, output),
    };
  } catch (err) {
    if (err instanceof ToolCallError) {
      throw err;
    }
    throw new ToolCallError(options.toolName, options.errorMessage ?? "Error executing Docker command", { cause: err });
  }
}

export type RunDockerScriptOptions = {
  toolName: string;
  /** Markdown message with bolded intent, e.g. `**Ran** docker stack deploy` */
  message: string;
  /** Label included at the start of the result text sent to the LLM */
  resultLabel: string;
  script: string;
  timeoutSeconds: number;
  minTimeout?: number;
  maxTimeout?: number;
  contextLines?: string[];
  logCommand?: string;
  errorMessage?: string;
};

export async function runDockerScript(agent: Agent, options: RunDockerScriptOptions): Promise<TokenRingToolResult> {
  const terminal = agent.requireServiceByType(TerminalService);
  const minTimeout = options.minTimeout ?? 5;
  const maxTimeout = options.maxTimeout ?? 120;
  const timeout = clampTimeout(options.timeoutSeconds, minTimeout, maxTimeout);

  agent.infoMessage(`[${options.toolName}] Executing: ${options.logCommand ?? options.script}`);

  try {
    const result = await terminal.runScript(options.script, { timeoutSeconds: timeout }, agent);
    const { exitCode, output } = getCommandResult(result);

    if (result.status === "timeout" || result.status === "unknownError") {
      throw new ToolCallError(options.toolName, options.errorMessage ?? "Error executing Docker command", {
        cause: new Error(output),
      });
    }

    return {
      message: options.message,
      result: formatDockerCommandOutput(options.resultLabel, options.contextLines ?? [], exitCode, output),
    };
  } catch (err) {
    if (err instanceof ToolCallError) {
      throw err;
    }
    throw new ToolCallError(options.toolName, options.errorMessage ?? "Error executing Docker command", { cause: err });
  }
}
