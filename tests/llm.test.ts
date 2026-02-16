import { LLMService } from '../src/services/llm';

describe('LLMService', () => {
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
