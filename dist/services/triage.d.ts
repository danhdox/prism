import { Config, IssueEvent, PullRequestEvent } from '../types';
import { StorageBackend } from '../types';
export declare class TriageService {
    private config;
    private storage;
    private llm;
    private github;
    constructor(config: Config, storage: StorageBackend);
    /**
     * Process an issue event
     */
    processIssue(event: IssueEvent): Promise<void>;
    /**
     * Process a pull request event
     */
    processPullRequest(event: PullRequestEvent): Promise<void>;
    /**
     * Detect duplicate issues
     */
    private detectIssueDuplicate;
    /**
     * Detect duplicate PRs
     */
    private detectPrDuplicate;
    /**
     * Generate PR review
     */
    private generatePrReview;
    /**
     * Suggest labels for an issue
     */
    private suggestIssueLabels;
    /**
     * Suggest labels for a PR
     */
    private suggestPrLabels;
    /**
     * Find similar issues using embeddings
     */
    private findSimilarIssues;
    /**
     * Find similar PRs using embeddings
     */
    private findSimilarPrs;
    /**
     * Format duplicate detection comment
     */
    private formatDuplicateComment;
    /**
     * Format PR review comment
     */
    private formatReviewComment;
    /**
     * Format a single finding
     */
    private formatFinding;
}
//# sourceMappingURL=triage.d.ts.map