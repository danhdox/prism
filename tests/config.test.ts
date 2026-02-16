import { ConfigSchema } from '../src/types';

describe('Configuration', () => {
  describe('ConfigSchema', () => {
    it('should validate correct configuration', () => {
      const config = {
        githubToken: 'ghp_test123',
        llmApiKey: 'sk-test123',
        llmProvider: 'openai' as const,
        llmModel: 'gpt-4',
        databaseUrl: '',
        duplicateThreshold: 0.85,
        enableDuplicateDetection: true,
        enablePrReview: true,
        enableLabeling: true,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid duplicate threshold', () => {
      const config = {
        githubToken: 'ghp_test123',
        llmApiKey: 'sk-test123',
        llmProvider: 'openai' as const,
        llmModel: 'gpt-4',
        duplicateThreshold: 1.5, // Invalid: > 1.0
        enableDuplicateDetection: true,
        enablePrReview: true,
        enableLabeling: true,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid provider', () => {
      const config = {
        githubToken: 'ghp_test123',
        llmApiKey: 'sk-test123',
        llmProvider: 'invalid',
        llmModel: 'gpt-4',
        duplicateThreshold: 0.85,
        enableDuplicateDetection: true,
        enablePrReview: true,
        enableLabeling: true,
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });
});
