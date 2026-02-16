import { LLMService } from '../src/services/llm';

import { Config } from '../src/types';

const chatCreateMock = jest.fn();
const embeddingCreateMock = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    embeddings: {
      create: embeddingCreateMock,
    },
    chat: {
      completions: {
        create: chatCreateMock,
      },
    },
  })),
}));

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LLMService', () => {
  describe('JSON parsing', () => {
    it('should parse fenced JSON responses', async () => {
      const service = new LLMService(baseConfig);
      chatCreateMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                '```json\n{"isDuplicate":true,"similarItems":[{"number":77,"title":"Known bug","url":"https://example.com/77","similarity":0.9}],"reasoning":"Identical description."}\n```',
            },
          },
        ],
      });

      const result = await service.detectDuplicate('Issue title', 'Issue body', [
        {
          number: 77,
          title: 'Known bug',
          body: 'Known bug details',
          url: 'https://example.com/77',
          similarity: 0.9,
        },
      ]);

      expect(result).toEqual({
        isDuplicate: true,
        similarItems: [
          {
            number: 77,
            title: 'Known bug',
            url: 'https://example.com/77',
            similarity: 0.9,
          },
        ],
        reasoning: 'Identical description.',
      });
      expect(chatCreateMock).toHaveBeenCalledTimes(1);
    });

    it('should retry and parse valid output after a malformed response', async () => {
      const service = new LLMService(baseConfig);
      chatCreateMock
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'not-json-at-all' } }],
        })
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content:
                  '{"labels":["bug"],"reasoning":"No duplicate found."}',
              },
            },
          ],
        });

      const result = await service.suggestLabels('Issue', 'desc', 'issue', ['bug', 'enhancement']);

      expect(result).toEqual({
        labels: ['bug'],
        reasoning: 'No duplicate found.',
      });
      expect(chatCreateMock).toHaveBeenCalledTimes(2);
    });

    it('should fall back when duplicate parsing fails repeatedly', async () => {
      const service = new LLMService(baseConfig);
      chatCreateMock.mockResolvedValue({
        choices: [{ message: { content: '{ this is not valid json' } }],
      });

      const result = await service.detectDuplicate('Issue title', 'Issue body', []);

      expect(result).toEqual({
        isDuplicate: false,
        similarItems: [],
        reasoning: 'Unable to parse LLM duplicate classification response. Falling back to non-duplicate.',
      });
      expect(chatCreateMock).toHaveBeenCalledTimes(3);
    });

    it('should fall back when review parsing fails repeatedly', async () => {
      const service = new LLMService(baseConfig);
      chatCreateMock.mockResolvedValue({
        choices: [{ message: { content: '{ [bad' } }],
      });

      const result = await service.generatePrReview('Fix', 'details', 'diff', [
        {
          filename: 'src/index.ts',
          additions: 10,
          deletions: 3,
        },
      ]);

      expect(result).toEqual({
        summary: 'AI review unavailable.',
        findings: [],
        suggestedLabels: [],
        estimatedComplexity: 'low',
      });
      expect(chatCreateMock).toHaveBeenCalledTimes(3);
    });

    it('should fall back when label parsing fails repeatedly', async () => {
      const service = new LLMService(baseConfig);
      chatCreateMock.mockResolvedValue({
        choices: [{ message: { content: 'nope' } }],
      });

      const result = await service.suggestLabels('Issue', 'Body', 'issue', ['bug', 'enhancement']);

      expect(result).toEqual({
        labels: [],
        reasoning: 'Unable to parse label suggestions. No labels were applied.',
      });
      expect(chatCreateMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity between identical vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = LLMService.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1.0);
    });

    it('should calculate similarity between orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = LLMService.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0.0);
    });

    it('should calculate similarity between opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = LLMService.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1.0);
    });

    it('should calculate similarity between partially similar vectors', () => {
      const vec1 = [1, 1, 0];
      const vec2 = [1, 0, 0];
      const similarity = LLMService.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0];
      expect(() => LLMService.cosineSimilarity(vec1, vec2)).toThrow();
    });
  });
});
