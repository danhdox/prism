import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  githubToken: z.string().min(1),
  llmApiKey: z.string().min(1),
  llmProvider: z.enum(['openai', 'anthropic']),
  llmModel: z.string(),
  databaseUrl: z.string().optional(),
  runBacklog: z.boolean(),
  backlogLimit: z.number().int().positive().max(500).optional(),
  backlogReportIssue: z.number().positive().int().optional(),
  visionDocument: z.string().optional(),
  duplicateThreshold: z.number().min(0).max(1),
  enableDuplicateDetection: z.boolean(),
  enablePrReview: z.boolean(),
  enableLabeling: z.boolean(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Duplicate detection result schema
export const DuplicateResultSchema = z.object({
  isDuplicate: z.boolean(),
  similarItems: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      url: z.string(),
      similarity: z.number(),
    })
  ),
  reasoning: z.string(),
});

export type DuplicateResult = z.infer<typeof DuplicateResultSchema>;

// PR review result schema
export const PrReviewSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      type: z.enum(['issue', 'suggestion', 'praise', 'question']),
      severity: z.enum(['critical', 'major', 'minor', 'info']),
      title: z.string(),
      description: z.string(),
      file: z.string().optional(),
      line: z.number().optional(),
    })
  ),
  suggestedLabels: z.array(z.string()),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
});

export type PrReview = z.infer<typeof PrReviewSchema>;

// Label suggestion schema
export const LabelSuggestionSchema = z.object({
  labels: z.array(z.string()),
  reasoning: z.string(),
});

export type LabelSuggestion = z.infer<typeof LabelSuggestionSchema>;

export const VisionAlignmentSchema = z.object({
  fit: z.enum(['aligned', 'off-track', 'neutral']),
  score: z.number().min(0).max(1),
  concerns: z.array(z.string()),
  recommendation: z.string(),
});

export type VisionAlignment = z.infer<typeof VisionAlignmentSchema>;

// GitHub webhook event types
export interface IssueEvent {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
    };
    labels: Array<{ name: string }>;
    html_url: string;
    created_at: string;
  };
  repository: {
    full_name: string;
  };
}

export interface PullRequestEvent {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
    };
    labels: Array<{ name: string }>;
    html_url: string;
    head: {
      sha: string;
    };
    base: {
      sha: string;
    };
    created_at: string;
  };
  repository: {
    full_name: string;
  };
}

// Embedding cache entry
export interface EmbeddingCache {
  sha: string;
  embedding: number[];
  createdAt: Date;
}

// Database storage interface
export interface StorageBackend {
  initialize(): Promise<void>;
  storeEmbedding(key: string, embedding: number[]): Promise<void>;
  getEmbedding(key: string): Promise<number[] | null>;
  findSimilar(embedding: number[], threshold: number, limit: number): Promise<SimilarItem[]>;
  close(): Promise<void>;
}

export interface SimilarItem {
  number: number;
  title: string;
  url: string;
  similarity: number;
  type: 'issue' | 'pr';
}
