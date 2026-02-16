import * as core from '@actions/core';
import { Config, ConfigSchema } from '../types';

/**
 * Load configuration from GitHub Action inputs
 */
export function loadConfig(): Config {
  const backlogReportIssueInput = core.getInput('backlog-report-issue');
  const backlogLimitInput = core.getInput('backlog-limit');
  const parsedBacklogReportIssue = backlogReportIssueInput
    ? Number.parseInt(backlogReportIssueInput, 10)
    : undefined;
  const parsedBacklogLimit = backlogLimitInput ? Number.parseInt(backlogLimitInput, 10) : undefined;

  const config = {
    githubToken: core.getInput('github-token', { required: true }),
    llmApiKey: core.getInput('llm-api-key', { required: true }),
    llmProvider: core.getInput('llm-provider') as 'openai' | 'anthropic',
    llmModel: core.getInput('llm-model'),
    databaseUrl: core.getInput('database-url'),
    runBacklog: core.getBooleanInput('run-backlog'),
    backlogLimit: Number.isNaN(parsedBacklogLimit as number) ? undefined : parsedBacklogLimit,
    backlogReportIssue: Number.isNaN(parsedBacklogReportIssue as number) ? undefined : parsedBacklogReportIssue,
    visionDocument: core.getInput('vision-document') || undefined,
    duplicateThreshold: parseFloat(core.getInput('duplicate-threshold')),
    enableDuplicateDetection: core.getBooleanInput('enable-duplicate-detection'),
    enablePrReview: core.getBooleanInput('enable-pr-review'),
    enableLabeling: core.getBooleanInput('enable-labeling'),
  };

  // Validate configuration
  return ConfigSchema.parse(config);
}

/**
 * Check if running in a valid GitHub Actions context
 */
export function validateContext(): boolean {
  const eventName = process.env.GITHUB_EVENT_NAME;
  return (
    eventName === 'issues' ||
    eventName === 'pull_request' ||
    eventName === 'schedule' ||
    eventName === 'workflow_dispatch'
  );
}

/**
 * Get event type
 */
export function getEventType(): 'issues' | 'pull_request' | 'backlog' | 'unknown' {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (eventName === 'issues') return 'issues';
  if (eventName === 'pull_request') return 'pull_request';
  if (eventName === 'schedule' || eventName === 'workflow_dispatch') return 'backlog';
  return 'unknown';
}
