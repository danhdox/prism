import OpenAI from 'openai';
import { type ZodType } from 'zod';
import {
  Config,
  DuplicateResult,
  DuplicateResultSchema,
  PrReview,
  PrReviewSchema,
  LabelSuggestion,
  LabelSuggestionSchema,
  VisionAlignment,
  VisionAlignmentSchema,
} from '../types';

export class LLMService {
  private client: OpenAI;
  private model: string;
  private readonly parseRetryCount = 2;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
    });
    this.model = config.llmModel;
  }

  private async parseLlmResponse<T>(
    responseFactory: () => Promise<string | null>,
    schema: ZodType<T>,
    fallback: T
  ): Promise<T> {
    for (let attempt = 0; attempt <= this.parseRetryCount; attempt++) {
      try {
        const content = this.sanitizeJson(await responseFactory());
        return schema.parse(JSON.parse(content));
      } catch {
        // Retry on parse or schema validation errors
      }
    }

    return fallback;
  }

  private sanitizeJson(content: string | null): string {
    if (!content) {
      return '';
    }

    const trimmed = content.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\n([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1).trim();
    }

    return trimmed;
  }

  /**
   * Generate embedding for text using OpenAI API
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * Detect if an issue is a duplicate
   */
  async detectDuplicate(
    title: string,
    body: string,
    similarItems: Array<{ number: number; title: string; body: string; url: string; similarity: number }>
  ): Promise<DuplicateResult> {
    const prompt = `You are a GitHub issue triage assistant. Analyze whether the following issue is a duplicate of any existing issues.

NEW ISSUE:
Title: ${title}
Body: ${body || 'No description provided'}

POTENTIALLY SIMILAR ISSUES:
${similarItems.map((item, i) => `
${i + 1}. Issue #${item.number} (Similarity: ${(item.similarity * 100).toFixed(1)}%)
   Title: ${item.title}
   Body: ${item.body || 'No description provided'}
   URL: ${item.url}
`).join('\n')}

Analyze whether the new issue is a duplicate. Consider:
1. Are they describing the same problem or feature request?
2. Do they share the same root cause or solution?
3. Would closing one as duplicate of the other make sense?

Respond with a JSON object:
{
  "isDuplicate": boolean,
  "similarItems": [
    {
      "number": number,
      "title": string,
      "url": string,
      "similarity": number (0.0-1.0)
    }
  ],
  "reasoning": "Detailed explanation of your decision"
}

Only include items you consider duplicates in similarItems. If not a duplicate, return empty array.`;

    const responseFactory = async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful GitHub issue triage assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      return response.choices[0].message.content;
    };

    return this.parseLlmResponse(responseFactory, DuplicateResultSchema, {
      isDuplicate: false,
      similarItems: [],
      reasoning: 'Unable to parse LLM duplicate classification response. Falling back to non-duplicate.',
    });
  }

  /**
   * Generate a structured PR review
   */
  async generatePrReview(
    title: string,
    body: string,
    diffContent: string,
    files: Array<{ filename: string; additions: number; deletions: number }>
  ): Promise<PrReview> {
    const prompt = `You are a code review assistant. Analyze this pull request and provide a structured review.

PR TITLE: ${title}
PR DESCRIPTION: ${body || 'No description provided'}

FILES CHANGED:
${files.map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')}

DIFF PREVIEW (first 2000 chars):
${diffContent.slice(0, 2000)}

Provide a structured review with:
1. A concise summary (2-3 sentences)
2. Key findings (issues, suggestions, praise, questions)
3. Suggested labels based on the changes
4. Estimated complexity

Respond with JSON:
{
  "summary": "Brief overview of the PR",
  "findings": [
    {
      "type": "issue|suggestion|praise|question",
      "severity": "critical|major|minor|info",
      "title": "Brief title",
      "description": "Detailed description",
      "file": "optional filename",
      "line": optional line number
    }
  ],
  "suggestedLabels": ["label1", "label2"],
  "estimatedComplexity": "low|medium|high"
}`;

    const responseFactory = async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful code review assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      return response.choices[0].message.content;
    };

    return this.parseLlmResponse(responseFactory, PrReviewSchema, {
      summary: 'AI review unavailable.',
      findings: [],
      suggestedLabels: [],
      estimatedComplexity: 'low',
    });
  }

  /**
   * Suggest labels for an issue or PR
   */
  async suggestLabels(
    title: string,
    body: string,
    type: 'issue' | 'pr',
    existingLabels: string[]
  ): Promise<LabelSuggestion> {
    const prompt = `You are a GitHub labeling assistant. Suggest appropriate labels for this ${type}.

TITLE: ${title}
BODY: ${body || 'No description provided'}

REPOSITORY EXISTING LABELS: ${existingLabels.join(', ')}

Suggest appropriate labels from the existing repository labels. Common label categories:
- Type: bug, feature, enhancement, documentation
- Priority: critical, high, medium, low
- Status: needs-review, in-progress, blocked
- Area: frontend, backend, api, database

Respond with JSON:
{
  "labels": ["label1", "label2"],
  "reasoning": "Brief explanation of label choices"
}`;

    const responseFactory = async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful labeling assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      return response.choices[0].message.content;
    };

    return this.parseLlmResponse(responseFactory, LabelSuggestionSchema, {
      labels: [],
      reasoning: 'Unable to parse label suggestions. No labels were applied.',
    });
  }

  /**
   * Assess PR alignment against a repository vision statement
   */
  async assessVisionAlignment(
    title: string,
    body: string,
    visionDocument: string,
    reviewSummary: string
  ): Promise<VisionAlignment> {
    const prompt = `You are a product strategy validator.

Vision document:
${visionDocument}

PR title: ${title}
PR body: ${body || 'No description provided'}
PR review summary: ${reviewSummary}

Return JSON:
{
  "fit": "aligned|off-track|neutral",
  "score": 0.0,
  "concerns": ["string"],
  "recommendation": "string"
}`;

    const responseFactory = async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a strict product strategy review assistant. Return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      return response.choices[0].message.content;
    };

    return this.parseLlmResponse(responseFactory, VisionAlignmentSchema, {
      fit: 'neutral',
      score: 0.5,
      concerns: [],
      recommendation: 'Unable to parse PR vision assessment. Treat as neutral.',
    });
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) {
        throw new Error('Vectors must contain finite values');
      }
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}
