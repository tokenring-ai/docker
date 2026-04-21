/**
 * Common TypeScript interfaces for the Docker package
 */

/**
 * Common Docker command execution result
 */
export interface DockerCommandResult {
  ok?: boolean | undefined;
  exitCode?: number | undefined;
  stdout?: string | undefined;
  stderr?: string | undefined;
  error?: string | undefined;
}
