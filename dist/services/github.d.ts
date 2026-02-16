import { Config } from '../types';
export declare class GitHubService {
    private octokit;
    constructor(config: Config);
    /**
     * Get all issues from the repository
     */
    getIssues(owner: string, repo: string): Promise<any[]>;
    /**
     * Get all pull requests from the repository
     */
    getPullRequests(owner: string, repo: string): Promise<any[]>;
    /**
     * Get PR diff content
     */
    getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string>;
    /**
     * Get PR files
     */
    getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<any[]>;
    /**
     * Post a comment on an issue
     */
    postIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void>;
    /**
     * Post a comment on a PR
     */
    postPullRequestComment(owner: string, repo: string, pullNumber: number, body: string): Promise<void>;
    /**
     * Add labels to an issue or PR
     */
    addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void>;
    /**
     * Get all labels in the repository
     */
    getRepositoryLabels(owner: string, repo: string): Promise<string[]>;
    /**
     * Get specific issue
     */
    getIssue(owner: string, repo: string, issueNumber: number): Promise<any>;
    /**
     * Get specific pull request
     */
    getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any>;
}
//# sourceMappingURL=github.d.ts.map