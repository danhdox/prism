import * as github from '@actions/github';
import { Config } from '../types';

export class GitHubService {
  private octokit: ReturnType<typeof github.getOctokit>;

  constructor(config: Config) {
    this.octokit = github.getOctokit(config.githubToken);
  }

  /**
   * Get all issues from the repository
   */
  async getIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all'): Promise<any[]> {
    const issues = await this.octokit.paginate(
      this.octokit.rest.issues.listForRepo,
      {
        owner,
        repo,
        state,
        per_page: 100,
      }
    );

    // Filter out pull requests (they're also returned by issues endpoint)
    return issues.filter(issue => !issue.pull_request);
  }

  /**
   * Get all pull requests from the repository
   */
  async getPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all'): Promise<any[]> {
    return await this.octokit.paginate(
      this.octokit.rest.pulls.list,
      {
        owner,
        repo,
        state,
        per_page: 100,
      }
    );
  }

  /**
   * Get PR diff content
   */
  async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    const response = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      mediaType: {
        format: 'diff',
      },
    });

    return response.data as unknown as string;
  }

  /**
   * Get PR files
   */
  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<any[]> {
    return await this.octokit.paginate(
      this.octokit.rest.pulls.listFiles,
      {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }
    );
  }

  /**
   * Post a comment on an issue
   */
  async postIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }

  /**
   * Post a comment on a PR
   */
  async postPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string
  ): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
  }

  /**
   * Add labels to an issue or PR
   */
  async addLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<void> {
    if (labels.length === 0) return;

    await this.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  }

  /**
   * Get all labels in the repository
   */
  async getRepositoryLabels(owner: string, repo: string): Promise<string[]> {
    const labels = await this.octokit.paginate(
      this.octokit.rest.issues.listLabelsForRepo,
      {
        owner,
        repo,
        per_page: 100,
      }
    );

    return labels.map(label => label.name);
  }

  /**
   * Get specific issue
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<any> {
    const response = await this.octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return response.data;
  }

  /**
   * Get specific pull request
   */
  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any> {
    const response = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    return response.data;
  }
}
