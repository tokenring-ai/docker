/**
 * Common TypeScript interfaces for the Docker package
 */

/**
 * Interface for the TokenRing Registry
 */
export interface TokenRingRegistry {
    requireFirstServiceByType: <T>(serviceType: any) => T;
}

/**
 * TLS configuration for Docker
 */
export interface TLSConfig {
    tlsVerify: boolean;
    tlsCACert?: string;
    tlsCert?: string;
    tlsKey?: string;
}

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