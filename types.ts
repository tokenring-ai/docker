/**
 * Common TypeScript interfaces for the Docker package
 */

/**
 * Common Docker command execution result
 */
export interface DockerCommandResult {
  ok?: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}