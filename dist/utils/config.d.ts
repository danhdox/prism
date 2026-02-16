import { Config } from '../types';
/**
 * Load configuration from GitHub Action inputs
 */
export declare function loadConfig(): Config;
/**
 * Check if running in a valid GitHub Actions context
 */
export declare function validateContext(): boolean;
/**
 * Get event type
 */
export declare function getEventType(): 'issues' | 'pull_request' | 'unknown';
//# sourceMappingURL=config.d.ts.map