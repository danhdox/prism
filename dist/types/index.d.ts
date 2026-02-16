import { z } from 'zod';
export declare const ConfigSchema: z.ZodObject<{
    githubToken: z.ZodString;
    llmApiKey: z.ZodString;
    llmProvider: z.ZodEnum<["openai", "anthropic"]>;
    llmModel: z.ZodString;
    databaseUrl: z.ZodOptional<z.ZodString>;
    duplicateThreshold: z.ZodNumber;
    enableDuplicateDetection: z.ZodBoolean;
    enablePrReview: z.ZodBoolean;
    enableLabeling: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    githubToken: string;
    llmApiKey: string;
    llmProvider: "openai" | "anthropic";
    llmModel: string;
    duplicateThreshold: number;
    enableDuplicateDetection: boolean;
    enablePrReview: boolean;
    enableLabeling: boolean;
    databaseUrl?: string | undefined;
}, {
    githubToken: string;
    llmApiKey: string;
    llmProvider: "openai" | "anthropic";
    llmModel: string;
    duplicateThreshold: number;
    enableDuplicateDetection: boolean;
    enablePrReview: boolean;
    enableLabeling: boolean;
    databaseUrl?: string | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export declare const DuplicateResultSchema: z.ZodObject<{
    isDuplicate: z.ZodBoolean;
    similarItems: z.ZodArray<z.ZodObject<{
        number: z.ZodNumber;
        title: z.ZodString;
        url: z.ZodString;
        similarity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        number: number;
        title: string;
        url: string;
        similarity: number;
    }, {
        number: number;
        title: string;
        url: string;
        similarity: number;
    }>, "many">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    isDuplicate: boolean;
    similarItems: {
        number: number;
        title: string;
        url: string;
        similarity: number;
    }[];
    reasoning: string;
}, {
    isDuplicate: boolean;
    similarItems: {
        number: number;
        title: string;
        url: string;
        similarity: number;
    }[];
    reasoning: string;
}>;
export type DuplicateResult = z.infer<typeof DuplicateResultSchema>;
export declare const PrReviewSchema: z.ZodObject<{
    summary: z.ZodString;
    findings: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["issue", "suggestion", "praise", "question"]>;
        severity: z.ZodEnum<["critical", "major", "minor", "info"]>;
        title: z.ZodString;
        description: z.ZodString;
        file: z.ZodOptional<z.ZodString>;
        line: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "issue" | "suggestion" | "praise" | "question";
        title: string;
        severity: "critical" | "major" | "minor" | "info";
        description: string;
        file?: string | undefined;
        line?: number | undefined;
    }, {
        type: "issue" | "suggestion" | "praise" | "question";
        title: string;
        severity: "critical" | "major" | "minor" | "info";
        description: string;
        file?: string | undefined;
        line?: number | undefined;
    }>, "many">;
    suggestedLabels: z.ZodArray<z.ZodString, "many">;
    estimatedComplexity: z.ZodEnum<["low", "medium", "high"]>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    findings: {
        type: "issue" | "suggestion" | "praise" | "question";
        title: string;
        severity: "critical" | "major" | "minor" | "info";
        description: string;
        file?: string | undefined;
        line?: number | undefined;
    }[];
    suggestedLabels: string[];
    estimatedComplexity: "low" | "medium" | "high";
}, {
    summary: string;
    findings: {
        type: "issue" | "suggestion" | "praise" | "question";
        title: string;
        severity: "critical" | "major" | "minor" | "info";
        description: string;
        file?: string | undefined;
        line?: number | undefined;
    }[];
    suggestedLabels: string[];
    estimatedComplexity: "low" | "medium" | "high";
}>;
export type PrReview = z.infer<typeof PrReviewSchema>;
export declare const LabelSuggestionSchema: z.ZodObject<{
    labels: z.ZodArray<z.ZodString, "many">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    labels: string[];
}, {
    reasoning: string;
    labels: string[];
}>;
export type LabelSuggestion = z.infer<typeof LabelSuggestionSchema>;
export interface IssueEvent {
    action: string;
    issue: {
        number: number;
        title: string;
        body: string | null;
        user: {
            login: string;
        };
        labels: Array<{
            name: string;
        }>;
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
        labels: Array<{
            name: string;
        }>;
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
export interface EmbeddingCache {
    sha: string;
    embedding: number[];
    createdAt: Date;
}
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
//# sourceMappingURL=index.d.ts.map