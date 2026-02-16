import * as core from '@actions/core';
import { Config, IssueEvent, PullRequestEvent, SimilarItem } from '../types';
import { LLMService } from './llm';
import { GitHubService } from './github';
import { StorageBackend } from '../types';

export class TriageService {
  private llm: LLMService;
  private github: GitHubService;

  constructor(
    private config: Config,
    private storage: StorageBackend
  ) {
    this.llm = new LLMService(config);
    this.github = new GitHubService(config);
  }

  /**
   * Process an issue event
   */
  async processIssue(event: IssueEvent): Promise<void> {
    const { issue, repository } = event;
    const [owner, repo] = repository.full_name.split('/');

    core.info(`Processing issue #${issue.number}: ${issue.title}`);

    const tasks: Promise<void>[] = [];

    // Duplicate detection
    if (this.config.enableDuplicateDetection) {
      tasks.push(this.detectIssueDuplicate(owner, repo, issue));
    }

    // Label suggestion
    if (this.config.enableLabeling) {
      tasks.push(this.suggestIssueLabels(owner, repo, issue));
    }

    await Promise.all(tasks);
  }

  /**
   * Process a pull request event
   */
  async processPullRequest(event: PullRequestEvent): Promise<void> {
    const { pull_request, repository } = event;
    const [owner, repo] = repository.full_name.split('/');

    core.info(`Processing PR #${pull_request.number}: ${pull_request.title}`);

    const tasks: Promise<void>[] = [];

    // Duplicate detection
    if (this.config.enableDuplicateDetection) {
      tasks.push(this.detectPrDuplicate(owner, repo, pull_request));
    }

    // PR review
    if (this.config.enablePrReview) {
      tasks.push(this.generatePrReview(owner, repo, pull_request));
    }

    // Label suggestion
    if (this.config.enableLabeling) {
      tasks.push(this.suggestPrLabels(owner, repo, pull_request));
    }

    await Promise.all(tasks);
  }

  /**
   * Detect duplicate issues
   */
  private async detectIssueDuplicate(
    owner: string,
    repo: string,
    issue: IssueEvent['issue']
  ): Promise<void> {
    try {
      core.info(`Checking for duplicate issues for #${issue.number}`);

      // Generate embedding for the issue
      const text = `${issue.title}\n\n${issue.body || ''}`;
      const embedding = await this.llm.generateEmbedding(text);

      // Store embedding with SHA-based caching
      const cacheKey = `issue-${issue.number}`;
      await this.storage.storeEmbedding(cacheKey, embedding);

      // Find similar issues
      const similarItems = await this.findSimilarIssues(owner, repo, embedding, issue.number);

      if (similarItems.length === 0) {
        core.info('No similar issues found');
        return;
      }

      // Get full issue details for similar items
      const similarIssuesWithBody = await Promise.all(
        similarItems.slice(0, 5).map(async (item) => {
          const fullIssue = await this.github.getIssue(owner, repo, item.number);
          return {
            number: item.number,
            title: item.title,
            body: fullIssue.body || '',
            url: item.url,
            similarity: item.similarity,
          };
        })
      );

      // Use LLM to determine if it's a duplicate
      const result = await this.llm.detectDuplicate(
        issue.title,
        issue.body || '',
        similarIssuesWithBody
      );

      // Post comment
      if (result.isDuplicate && result.similarItems.length > 0) {
        const comment = this.formatDuplicateComment(result, 'issue');
        await this.github.postIssueComment(owner, repo, issue.number, comment);
        core.info(`Posted duplicate detection comment for issue #${issue.number}`);
      } else {
        core.info('Issue is not a duplicate');
      }
    } catch (error) {
      core.error(`Error detecting duplicate issue: ${error}`);
    }
  }

  /**
   * Detect duplicate PRs
   */
  private async detectPrDuplicate(
    owner: string,
    repo: string,
    pr: PullRequestEvent['pull_request']
  ): Promise<void> {
    try {
      core.info(`Checking for duplicate PRs for #${pr.number}`);

      // Generate embedding for the PR
      const text = `${pr.title}\n\n${pr.body || ''}`;
      const embedding = await this.llm.generateEmbedding(text);

      // Store embedding with SHA-based caching
      const cacheKey = `pr-${pr.head.sha}`;
      await this.storage.storeEmbedding(cacheKey, embedding);

      // Find similar PRs
      const similarItems = await this.findSimilarPrs(owner, repo, embedding, pr.number);

      if (similarItems.length === 0) {
        core.info('No similar PRs found');
        return;
      }

      // Get full PR details for similar items
      const similarPrsWithBody = await Promise.all(
        similarItems.slice(0, 5).map(async (item) => {
          const fullPr = await this.github.getPullRequest(owner, repo, item.number);
          return {
            number: item.number,
            title: item.title,
            body: fullPr.body || '',
            url: item.url,
            similarity: item.similarity,
          };
        })
      );

      // Use LLM to determine if it's a duplicate
      const result = await this.llm.detectDuplicate(
        pr.title,
        pr.body || '',
        similarPrsWithBody
      );

      // Post comment
      if (result.isDuplicate && result.similarItems.length > 0) {
        const comment = this.formatDuplicateComment(result, 'pr');
        await this.github.postPullRequestComment(owner, repo, pr.number, comment);
        core.info(`Posted duplicate detection comment for PR #${pr.number}`);
      } else {
        core.info('PR is not a duplicate');
      }
    } catch (error) {
      core.error(`Error detecting duplicate PR: ${error}`);
    }
  }

  /**
   * Generate PR review
   */
  private async generatePrReview(
    owner: string,
    repo: string,
    pr: PullRequestEvent['pull_request']
  ): Promise<void> {
    try {
      core.info(`Generating review for PR #${pr.number}`);

      // Get PR diff and files
      const [diff, files] = await Promise.all([
        this.github.getPullRequestDiff(owner, repo, pr.number),
        this.github.getPullRequestFiles(owner, repo, pr.number),
      ]);

      // Generate review
      const review = await this.llm.generatePrReview(
        pr.title,
        pr.body || '',
        diff,
        files.map(f => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
        }))
      );

      // Post review comment
      const comment = this.formatReviewComment(review);
      await this.github.postPullRequestComment(owner, repo, pr.number, comment);
      core.info(`Posted review comment for PR #${pr.number}`);

      // Apply suggested labels
      if (this.config.enableLabeling && review.suggestedLabels.length > 0) {
        const repoLabels = await this.github.getRepositoryLabels(owner, repo);
        const validLabels = review.suggestedLabels.filter(label =>
          repoLabels.includes(label)
        );

        if (validLabels.length > 0) {
          await this.github.addLabels(owner, repo, pr.number, validLabels);
          core.info(`Applied labels to PR #${pr.number}: ${validLabels.join(', ')}`);
        }
      }
    } catch (error) {
      core.error(`Error generating PR review: ${error}`);
    }
  }

  /**
   * Suggest labels for an issue
   */
  private async suggestIssueLabels(
    owner: string,
    repo: string,
    issue: IssueEvent['issue']
  ): Promise<void> {
    try {
      core.info(`Suggesting labels for issue #${issue.number}`);

      const repoLabels = await this.github.getRepositoryLabels(owner, repo);
      const suggestion = await this.llm.suggestLabels(
        issue.title,
        issue.body || '',
        'issue',
        repoLabels
      );

      if (suggestion.labels.length > 0) {
        await this.github.addLabels(owner, repo, issue.number, suggestion.labels);
        core.info(`Applied labels to issue #${issue.number}: ${suggestion.labels.join(', ')}`);
      }
    } catch (error) {
      core.error(`Error suggesting labels for issue: ${error}`);
    }
  }

  /**
   * Suggest labels for a PR
   */
  private async suggestPrLabels(
    owner: string,
    repo: string,
    pr: PullRequestEvent['pull_request']
  ): Promise<void> {
    try {
      core.info(`Suggesting labels for PR #${pr.number}`);

      const repoLabels = await this.github.getRepositoryLabels(owner, repo);
      const suggestion = await this.llm.suggestLabels(
        pr.title,
        pr.body || '',
        'pr',
        repoLabels
      );

      if (suggestion.labels.length > 0) {
        await this.github.addLabels(owner, repo, pr.number, suggestion.labels);
        core.info(`Applied labels to PR #${pr.number}: ${suggestion.labels.join(', ')}`);
      }
    } catch (error) {
      core.error(`Error suggesting labels for PR: ${error}`);
    }
  }

  /**
   * Find similar issues using embeddings
   */
  private async findSimilarIssues(
    owner: string,
    repo: string,
    embedding: number[],
    excludeNumber: number
  ): Promise<SimilarItem[]> {
    // Try to find from storage first
    const similarFromDb = await this.storage.findSimilar(
      embedding,
      this.config.duplicateThreshold,
      10
    );

    if (similarFromDb.length > 0) {
      return similarFromDb.filter(item => item.number !== excludeNumber && item.type === 'issue');
    }

    // Fallback: get all issues and compute similarity
    const issues = await this.github.getIssues(owner, repo);
    const similarities: SimilarItem[] = [];

    for (const issue of issues) {
      if (issue.number === excludeNumber) continue;

      const issueText = `${issue.title}\n\n${issue.body || ''}`;
      const issueEmbedding = await this.llm.generateEmbedding(issueText);
      const similarity = LLMService.cosineSimilarity(embedding, issueEmbedding);

      if (similarity >= this.config.duplicateThreshold) {
        similarities.push({
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          similarity,
          type: 'issue',
        });
      }

      // Store for future use
      await this.storage.storeEmbedding(`issue-${issue.number}`, issueEmbedding);
    }

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  }

  /**
   * Find similar PRs using embeddings
   */
  private async findSimilarPrs(
    owner: string,
    repo: string,
    embedding: number[],
    excludeNumber: number
  ): Promise<SimilarItem[]> {
    // Try to find from storage first
    const similarFromDb = await this.storage.findSimilar(
      embedding,
      this.config.duplicateThreshold,
      10
    );

    if (similarFromDb.length > 0) {
      return similarFromDb.filter(item => item.number !== excludeNumber && item.type === 'pr');
    }

    // Fallback: get all PRs and compute similarity
    const prs = await this.github.getPullRequests(owner, repo);
    const similarities: SimilarItem[] = [];

    for (const pr of prs) {
      if (pr.number === excludeNumber) continue;

      const prText = `${pr.title}\n\n${pr.body || ''}`;
      const prEmbedding = await this.llm.generateEmbedding(prText);
      const similarity = LLMService.cosineSimilarity(embedding, prEmbedding);

      if (similarity >= this.config.duplicateThreshold) {
        similarities.push({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          similarity,
          type: 'pr',
        });
      }

      // Store for future use
      await this.storage.storeEmbedding(`pr-${pr.head.sha}`, prEmbedding);
    }

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  }

  /**
   * Format duplicate detection comment
   */
  private formatDuplicateComment(result: any, type: 'issue' | 'pr'): string {
    const emoji = type === 'issue' ? '🔍' : '🔀';

    let comment = `${emoji} **Potential Duplicate Detected**\n\n`;
    comment += `This ${type} appears to be similar to:\n\n`;

    for (const item of result.similarItems) {
      const percentage = (item.similarity * 100).toFixed(1);
      comment += `- [#${item.number}](${item.url}) - ${item.title} (${percentage}% similar)\n`;
    }

    comment += `\n**Analysis:**\n${result.reasoning}\n\n`;
    comment += `---\n`;
    comment += `*This analysis was generated by [PRism](https://github.com/danhdox/prism) AI triage.*`;

    return comment;
  }

  /**
   * Format PR review comment
   */
  private formatReviewComment(review: any): string {
    let comment = `## 🤖 AI Code Review\n\n`;
    comment += `**Summary:** ${review.summary}\n\n`;

    if (review.findings.length > 0) {
      comment += `### Findings\n\n`;

      const grouped = {
        issue: review.findings.filter((f: any) => f.type === 'issue'),
        suggestion: review.findings.filter((f: any) => f.type === 'suggestion'),
        praise: review.findings.filter((f: any) => f.type === 'praise'),
        question: review.findings.filter((f: any) => f.type === 'question'),
      };

      if (grouped.issue.length > 0) {
        comment += `#### ⚠️ Issues\n`;
        for (const finding of grouped.issue) {
          comment += this.formatFinding(finding);
        }
        comment += `\n`;
      }

      if (grouped.suggestion.length > 0) {
        comment += `#### 💡 Suggestions\n`;
        for (const finding of grouped.suggestion) {
          comment += this.formatFinding(finding);
        }
        comment += `\n`;
      }

      if (grouped.praise.length > 0) {
        comment += `#### ✨ Highlights\n`;
        for (const finding of grouped.praise) {
          comment += this.formatFinding(finding);
        }
        comment += `\n`;
      }

      if (grouped.question.length > 0) {
        comment += `#### ❓ Questions\n`;
        for (const finding of grouped.question) {
          comment += this.formatFinding(finding);
        }
        comment += `\n`;
      }
    }

    comment += `**Estimated Complexity:** ${review.estimatedComplexity}\n\n`;

    if (review.suggestedLabels.length > 0) {
      comment += `**Suggested Labels:** ${review.suggestedLabels.map((l: string) => `\`${l}\``).join(', ')}\n\n`;
    }

    comment += `---\n`;
    comment += `*This review was generated by [PRism](https://github.com/danhdox/prism) AI triage.*`;

    return comment;
  }

  /**
   * Format a single finding
   */
  private formatFinding(finding: any): string {
    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      major: '🟠',
      minor: '🟡',
      info: '🔵',
    };

    let text = `- ${severityEmoji[finding.severity] || '⚪'} **${finding.title}**\n`;
    text += `  ${finding.description}\n`;

    if (finding.file) {
      text += `  📁 \`${finding.file}\``;
      if (finding.line) {
        text += `:${finding.line}`;
      }
      text += `\n`;
    }

    return text;
  }
}
