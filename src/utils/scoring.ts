import { VisionAlignment } from '../types';

export type BacklogItemType = 'issue' | 'pr';

export type DedupeStatus = 'duplicate' | 'related' | 'distinct';

export interface ScoreBacklogItemInput {
  itemType: BacklogItemType;
  dedupeStatus: DedupeStatus;
  duplicateSimilarity: number;
  visionAlignment?: VisionAlignment;
  severityCounts?: {
    critical?: number;
    major?: number;
    minor?: number;
    info?: number;
  };
  reviewComplexity?: 'low' | 'medium' | 'high';
}

export interface BacklogScore {
  score: number;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Score an item discovered during backlog runs.
 *
 * Returns a score in the range [0, 100] where higher scores mean higher
 * triage priority.
 */
export function scoreBacklogItem(input: ScoreBacklogItemInput): BacklogScore {
  const similarity = clamp(Number.isFinite(input.duplicateSimilarity) ? input.duplicateSimilarity : 0, 0, 1);
  const reasons: string[] = [];
  let score = 10;

  if (input.dedupeStatus === 'duplicate') {
    score += 55;
    reasons.push('High duplicate likelihood');
  } else if (input.dedupeStatus === 'related') {
    score += 25;
    reasons.push('Moderate duplicate signal');
  } else {
    reasons.push('No duplicate overlap detected');
  }

  score += similarity * 30;
  if (similarity > 0.9) {
    reasons.push('Very high semantic similarity');
  } else if (similarity > 0.75) {
    reasons.push('Strong semantic similarity');
  }

  if (input.itemType === 'pr') {
    if (input.severityCounts) {
      const critical = clamp(input.severityCounts.critical ?? 0, 0, 10);
      const major = clamp(input.severityCounts.major ?? 0, 0, 20);
      const minor = clamp(input.severityCounts.minor ?? 0, 0, 30);
      score += critical * 3 + major * 1.5 + minor * 0.5;
      if (critical > 0) reasons.push(`${critical} critical finding(s)`);
      if (major > 0) reasons.push(`${major} major finding(s)`);
    }

    if (input.reviewComplexity === 'high') {
      score += 5;
      reasons.push('High review complexity');
    } else if (input.reviewComplexity === 'medium') {
      score += 2;
      reasons.push('Medium review complexity');
    }
  }

  if (input.visionAlignment?.fit === 'off-track') {
    score += 10;
    reasons.push('Vision alignment mismatch');
  } else if (input.visionAlignment?.fit === 'aligned') {
    score -= 5;
    reasons.push('Aligns with vision goals');
  } else if (input.visionAlignment?.fit === 'neutral') {
    reasons.push('Vision alignment is neutral');
  }

  score = clamp(Math.round(score), 0, 100);

  return { score, reasons };
}

