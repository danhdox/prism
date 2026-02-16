import OpenAI from 'openai';
import { Config, DuplicateResult, DuplicateResultSchema, PrReview, PrReviewSchema, LabelSuggestion, LabelSuggestionSchema } from '../types';

export class LLMService {
  private client: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
    });
    this.model = config.llmModel;
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful GitHub issue triage assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const result = JSON.parse(content);
    return DuplicateResultSchema.parse(result);
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful code review assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const result = JSON.parse(content);
    return PrReviewSchema.parse(result);
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful labeling assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const result = JSON.parse(content);
    return LabelSuggestionSchema.parse(result);
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
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
