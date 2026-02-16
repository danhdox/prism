import { StorageBackend, SimilarItem } from '../types';
/**
 * In-memory storage backend (stateless mode)
 */
export declare class MemoryStorage implements StorageBackend {
    private cache;
    initialize(): Promise<void>;
    storeEmbedding(key: string, embedding: number[]): Promise<void>;
    getEmbedding(key: string): Promise<number[] | null>;
    findSimilar(_embedding: number[], _threshold: number, _limit: number): Promise<SimilarItem[]>;
    close(): Promise<void>;
}
/**
 * PostgreSQL + pgvector storage backend (stateful mode)
 */
export declare class PostgresStorage implements StorageBackend {
    private pool;
    constructor(connectionString: string);
    initialize(): Promise<void>;
    storeEmbedding(key: string, embedding: number[]): Promise<void>;
    getEmbedding(key: string): Promise<number[] | null>;
    findSimilar(embedding: number[], threshold: number, limit: number): Promise<SimilarItem[]>;
    close(): Promise<void>;
}
/**
 * Factory function to create storage backend based on configuration
 */
export declare function createStorage(databaseUrl?: string): StorageBackend;
//# sourceMappingURL=storage.d.ts.map