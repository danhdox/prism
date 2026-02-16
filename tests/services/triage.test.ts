import { Config, StorageBackend } from '../../src/types';
import { TriageService } from '../../src/services/triage';
import { GitHubService } from '../../src/services/github';
import { LLMService } from '../../src/services/llm';
import issueEventFixture from '../fixtures/events/issue-opened.json';
import prEventFixture from '../fixtures/events/pull-request-opened.json';

const baseConfig: Config = {
  githubToken: 'ghp_test123',
  llmApiKey: 'sk_test123',
  llmProvider: 'openai',
  llmModel: 'gpt-4',
  databaseUrl: '',
  runBacklog: false,
  duplicateThreshold: 0.85,
  enableDuplicateDetection: true,
  enablePrReview: true,
  enableLabeling: true,
};

const makeStorage = (): jest.Mocked<StorageBackend> => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  storeEmbedding: jest.fn().mockResolvedValue(undefined),
  getEmbedding: jest.fn().mockResolvedValue(null),
  findSimilar: jest.fn().mockResolvedValue([]),
  close: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TriageService backlog dedupe classification', () => {
  it('classifies duplicate backlog items as duplicate', async () => {
    const storage = makeStorage();
    storage.findSimilar.mockResolvedValueOnce([
      {
        number: 100,
        title: 'Previous PR duplicate',
        url: 'https://github.com/example-org/example-repo/issues/100',
        similarity: 0.93,
        type: 'issue',
      },
    ]);

    jest
      .spyOn(GitHubService.prototype, 'getIssues')
      .mockResolvedValue([
        {
          number: 101,
          title: issueEventFixture.issue.title,
          body: issueEventFixture.issue.body,
          html_url: issueEventFixture.issue.html_url,
        },
      ] as any);

    jest
      .spyOn(GitHubService.prototype, 'getPullRequests')
      .mockResolvedValueOnce([] as any);

    jest.spyOn(GitHubService.prototype, 'getIssue').mockResolvedValueOnce({
      number: 100,
      title: 'Previous PR duplicate',
      body: 'same issue body',
      html_url: 'https://github.com/example-org/example-repo/issues/100',
    } as any);

    jest.spyOn(LLMService.prototype, 'generateEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
    jest
      .spyOn(LLMService.prototype, 'detectDuplicate')
      .mockResolvedValueOnce({
        isDuplicate: true,
        similarItems: [
          {
            number: 100,
            title: 'Previous PR duplicate',
            url: 'https://github.com/example-org/example-repo/issues/100',
            similarity: 0.93,
          },
        ],
        reasoning: 'Exact same requirement.',
      });

    const triage = new TriageService(baseConfig, storage);
    const items = await triage.processBacklog('example-org', 'example-repo');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'issue',
      number: 101,
      dedupeStatus: 'duplicate',
    });
  });

  it('classifies high-similarity issues as related when LLM says not duplicate', async () => {
    const storage = makeStorage();
    storage.findSimilar.mockResolvedValueOnce([
      {
        number: 100,
        title: 'Related issue candidate',
        url: 'https://github.com/example-org/example-repo/issues/100',
        similarity: 0.8,
        type: 'issue',
      },
    ]);

    jest
      .spyOn(GitHubService.prototype, 'getIssues')
      .mockResolvedValueOnce([
        {
          number: 101,
          title: issueEventFixture.issue.title,
          body: issueEventFixture.issue.body,
          html_url: issueEventFixture.issue.html_url,
        },
      ] as any);

    jest.spyOn(GitHubService.prototype, 'getPullRequests').mockResolvedValueOnce([] as any);
    jest.spyOn(GitHubService.prototype, 'getIssue').mockResolvedValueOnce({
      number: 100,
      title: 'Related issue candidate',
      body: 'similar but not duplicate',
      html_url: 'https://github.com/example-org/example-repo/issues/100',
    } as any);

    jest.spyOn(LLMService.prototype, 'generateEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
    jest
      .spyOn(LLMService.prototype, 'detectDuplicate')
      .mockResolvedValueOnce({
        isDuplicate: false,
        similarItems: [
          {
            number: 100,
            title: 'Related issue candidate',
            url: 'https://github.com/example-org/example-repo/issues/100',
            similarity: 0.8,
          },
        ],
        reasoning: 'Related but not duplicate.',
      });

    const triage = new TriageService(baseConfig, storage);
    const items = await triage.processBacklog('example-org', 'example-repo');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'issue',
      number: 101,
      dedupeStatus: 'related',
    });
  });

  it('classifies items as distinct when similarity is below related threshold', async () => {
    const storage = makeStorage();
    storage.findSimilar.mockResolvedValueOnce([
      {
        number: 100,
        title: 'Noisy match',
        url: 'https://github.com/example-org/example-repo/issues/100',
        similarity: 0.2,
        type: 'issue',
      },
    ]);

    jest
      .spyOn(GitHubService.prototype, 'getIssues')
      .mockResolvedValue([
        {
          number: 101,
          title: issueEventFixture.issue.title,
          body: issueEventFixture.issue.body,
          html_url: issueEventFixture.issue.html_url,
        },
      ] as any);
    jest.spyOn(GitHubService.prototype, 'getPullRequests').mockResolvedValueOnce([] as any);
    jest.spyOn(GitHubService.prototype, 'getIssue').mockResolvedValue({
      number: 100,
      title: 'Noisy match',
      body: 'Only partially related',
      html_url: 'https://github.com/example-org/example-repo/issues/100',
    } as any);
    jest.spyOn(LLMService.prototype, 'generateEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
    jest.spyOn(LLMService.prototype, 'detectDuplicate').mockResolvedValue({
      isDuplicate: false,
      similarItems: [],
      reasoning: 'No relevant duplicate.',
    });

    const triage = new TriageService(baseConfig, storage);
    const items = await triage.processBacklog('example-org', 'example-repo');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'issue',
      number: 101,
      dedupeStatus: 'distinct',
    });
  });
});

describe('TriageService label triggers', () => {
  it('applies valid label suggestions for issues when enabled', async () => {
    const storage = makeStorage();
    const config: Config = {
      ...baseConfig,
      enableDuplicateDetection: false,
      enablePrReview: false,
      enableLabeling: true,
    };
    const addLabelsSpy = jest.spyOn(GitHubService.prototype, 'addLabels').mockResolvedValue();
    jest.spyOn(GitHubService.prototype, 'getRepositoryLabels').mockResolvedValue(['bug', 'enhancement']);
    jest.spyOn(LLMService.prototype, 'suggestLabels').mockResolvedValue({
      labels: ['bug', 'not-in-repo'],
      reasoning: 'Issue is bug-like',
    });
    const postIssueCommentSpy = jest.spyOn(GitHubService.prototype, 'postIssueComment').mockResolvedValue();
    const triage = new TriageService(config, storage);

    await triage.processIssue(issueEventFixture as any);

    expect(addLabelsSpy).toHaveBeenCalledWith(
      'example-org',
      'example-repo',
      issueEventFixture.issue.number,
      ['bug']
    );
    expect(postIssueCommentSpy).not.toHaveBeenCalled();
  });

  it('applies valid labels from PR review suggestions', async () => {
    const storage = makeStorage();
    const config: Config = {
      ...baseConfig,
      enableDuplicateDetection: false,
      enablePrReview: true,
      enableLabeling: true,
    };

    jest.spyOn(GitHubService.prototype, 'getPullRequestDiff').mockResolvedValue('diff content');
    jest
      .spyOn(GitHubService.prototype, 'getPullRequestFiles')
      .mockResolvedValue([{ filename: 'src/index.ts', additions: 10, deletions: 2 }] as any);
    jest.spyOn(GitHubService.prototype, 'getRepositoryLabels').mockResolvedValue(['security', 'performance']);
    jest.spyOn(LLMService.prototype, 'generatePrReview').mockResolvedValue({
      summary: 'Looks good with risk.',
      findings: [],
      suggestedLabels: ['security', 'database'],
      estimatedComplexity: 'medium',
    });
    jest.spyOn(LLMService.prototype, 'suggestLabels').mockResolvedValue({ labels: [], reasoning: 'noop' });

    const addLabelsSpy = jest.spyOn(GitHubService.prototype, 'addLabels').mockResolvedValue();
    const postPrCommentSpy = jest.spyOn(GitHubService.prototype, 'postPullRequestComment').mockResolvedValue();
    const triage = new TriageService(config, storage);

    await triage.processPullRequest(prEventFixture as any);

    expect(postPrCommentSpy).toHaveBeenCalledWith(
      'example-org',
      'example-repo',
      prEventFixture.pull_request.number,
      expect.stringContaining('## 🤖 AI Code Review')
    );
    expect(addLabelsSpy).toHaveBeenCalledWith(
      'example-org',
      'example-repo',
      prEventFixture.pull_request.number,
      ['security']
    );
    expect(addLabelsSpy).toHaveBeenCalledTimes(1);
  });
});

describe('TriageService SHA caching behavior', () => {
  it('stores PR embeddings with the PR head SHA key', async () => {
    const storage = makeStorage();
    const config: Config = {
      ...baseConfig,
      enableDuplicateDetection: true,
      enablePrReview: false,
      enableLabeling: false,
    };

    jest
      .spyOn(LLMService.prototype, 'generateEmbedding')
      .mockResolvedValue([0.1, 0.2, 0.3]);
    jest.spyOn(GitHubService.prototype, 'getPullRequests').mockResolvedValueOnce([]);
    const triage = new TriageService(config, storage);

    await triage.processPullRequest(prEventFixture as any);

    expect(storage.storeEmbedding).toHaveBeenCalledWith(
      `pr-${prEventFixture.pull_request.head.sha}`,
      [0.1, 0.2, 0.3]
    );
  });
});
