import { scoreBacklogItem } from '../../src/utils/scoring';

describe('scoreBacklogItem', () => {
  it('should prioritize duplicate + high similarity with off-track vision', () => {
    const result = scoreBacklogItem({
      itemType: 'pr',
      dedupeStatus: 'duplicate',
      duplicateSimilarity: 0.96,
      visionAlignment: {
        fit: 'off-track',
        score: 0.2,
        concerns: ['Scope creep'],
        recommendation: 'Re-evaluate against roadmap',
      },
      severityCounts: {
        critical: 1,
        major: 2,
        minor: 3,
        info: 4,
      },
      reviewComplexity: 'high',
    });

    expect(result.score).toBe(100);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'High duplicate likelihood',
        'Very high semantic similarity',
        '1 critical finding(s)',
        '2 major finding(s)',
        'High review complexity',
        'Vision alignment mismatch',
      ])
    );
  });

  it('should classify related issues as medium-priority', () => {
    const result = scoreBacklogItem({
      itemType: 'issue',
      dedupeStatus: 'related',
      duplicateSimilarity: 0.82,
      visionAlignment: {
        fit: 'neutral',
        score: 0.5,
        concerns: [],
        recommendation: 'monitor',
      },
    });

    expect(result.score).toBeGreaterThan(30);
    expect(result.score).toBeLessThan(90);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'Moderate duplicate signal',
        'Strong semantic similarity',
        'Vision alignment is neutral',
      ])
    );
  });

  it('should keep distinct issues at lower risk even with perfect similarity', () => {
    const result = scoreBacklogItem({
      itemType: 'issue',
      dedupeStatus: 'distinct',
      duplicateSimilarity: 1,
      visionAlignment: {
        fit: 'aligned',
        score: 0.95,
        concerns: [],
        recommendation: 'good fit',
      },
    });

    expect(result.score).toBe(35);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'No duplicate overlap detected',
        'Very high semantic similarity',
        'Aligns with vision goals',
      ])
    );
  });

  it('should clamp negative and over-large similarity values safely', () => {
    const low = scoreBacklogItem({
      itemType: 'issue',
      dedupeStatus: 'distinct',
      duplicateSimilarity: -5,
    });

    const high = scoreBacklogItem({
      itemType: 'pr',
      dedupeStatus: 'related',
      duplicateSimilarity: 42,
      reviewComplexity: 'low',
    });

    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(high.score).toBeLessThanOrEqual(100);
    expect(low.score).toBeLessThan(high.score);
  });

  it('should reward medium and low review complexity consistently', () => {
    const medium = scoreBacklogItem({
      itemType: 'pr',
      dedupeStatus: 'related',
      duplicateSimilarity: 0.7,
      reviewComplexity: 'medium',
      severityCounts: { critical: 0, major: 0, minor: 0, info: 0 },
    });

    const low = scoreBacklogItem({
      itemType: 'pr',
      dedupeStatus: 'related',
      duplicateSimilarity: 0.7,
      reviewComplexity: 'low',
      severityCounts: { critical: 0, major: 0, minor: 0, info: 0 },
    });

    expect(medium.score).toBeGreaterThan(low.score);
  });
});
