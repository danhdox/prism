import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfig, validateContext, getEventType } from './utils/config';
import { createStorage } from './services/storage';
import { TriageService } from './services/triage';
import { IssueEvent, PullRequestEvent } from './types';

/**
 * Main entry point for the GitHub Action
 */
async function run(): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate context
    if (!validateContext()) {
      core.info('Action only runs on issue/PR/backlog events. Skipping.');
      return;
    }

    const eventType = getEventType();
    core.info(`Processing ${eventType} event`);

    // Load configuration
    const config = loadConfig();
    core.info('Configuration loaded successfully');

    // Log configuration (without sensitive data)
    core.info(`LLM Provider: ${config.llmProvider}`);
    core.info(`LLM Model: ${config.llmModel}`);
    core.info(`Duplicate Threshold: ${config.duplicateThreshold}`);
    core.info(`Database: ${config.databaseUrl ? 'Enabled (stateful)' : 'Disabled (stateless)'}`);
    core.info(`Features: Duplicate=${config.enableDuplicateDetection}, Review=${config.enablePrReview}, Labels=${config.enableLabeling}`);

    // Initialize storage
    const storage = createStorage(config.databaseUrl);
    await storage.initialize();
    core.info('Storage initialized');

    try {
      // Initialize triage service
      const triage = new TriageService(config, storage);

      // Process based on event type
      const context = github.context;
      if (eventType === 'issues') {
        const payload = context.payload as unknown as IssueEvent;
        await triage.processIssue(payload);
      } else if (eventType === 'pull_request') {
        const payload = context.payload as unknown as PullRequestEvent;
        await triage.processPullRequest(payload);
      } else if (eventType === 'backlog') {
        if (!config.runBacklog) {
          core.info('Backlog run disabled (run-backlog=false). Skipping.');
        } else if (!context.payload.repository?.full_name) {
          throw new Error('Missing repository context for backlog run.');
        } else {
          const [owner, repo] = context.payload.repository.full_name.split('/');
          const reportItems = await triage.processBacklog(owner, repo);
          core.info(`Backlog scan completed: ${reportItems.length} item(s) scored.`);
          if (config.backlogReportIssue) {
            await triage.postBacklogReport(owner, repo, config.backlogReportIssue, reportItems);
            core.info(`Posted backlog report to issue #${config.backlogReportIssue}`);
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      core.info(`✅ Triage completed successfully in ${duration}s`);

      // Check if we met the 60s SLA
      if (Date.now() - startTime > 60000) {
        core.warning(`⚠️ Processing took longer than 60s SLA: ${duration}s`);
      }
    } finally {
      // Clean up storage
      await storage.close();
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    core.error(`❌ Triage failed after ${duration}s`);

    if (error instanceof Error) {
      core.setFailed(error.message);
      core.error(error.stack || '');
    } else {
      core.setFailed(String(error));
    }
  }
}

// Run the action
run();
