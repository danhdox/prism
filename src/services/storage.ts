import { Pool } from 'pg';
import { StorageBackend, SimilarItem } from '../types';

/**
 * In-memory storage backend (stateless mode)
 */
export class MemoryStorage implements StorageBackend {
  private cache: Map<string, { embedding: number[]; timestamp: number }> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
  }

  async storeEmbedding(key: string, embedding: number[]): Promise<void> {
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
    });
  }

  async getEmbedding(key: string): Promise<number[] | null> {
    const entry = this.cache.get(key);
    return entry ? entry.embedding : null;
  }

  async findSimilar(
    _embedding: number[],
    _threshold: number,
    _limit: number
  ): Promise<SimilarItem[]> {
    // In-memory storage cannot find similar items across runs
    // This is a limitation of stateless mode
    return [];
  }

  async close(): Promise<void> {
    this.cache.clear();
  }
}

/**
 * PostgreSQL + pgvector storage backend (stateful mode)
 */
export class PostgresStorage implements StorageBackend {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');

      // Create embeddings table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS prism_embeddings (
          id SERIAL PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          item_number INTEGER NOT NULL,
          item_type TEXT NOT NULL,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          embedding vector(1536) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create index for faster similarity search
      await client.query(`
        CREATE INDEX IF NOT EXISTS prism_embeddings_embedding_idx
        ON prism_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);

      // Create index on key for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS prism_embeddings_key_idx
        ON prism_embeddings (key)
      `);
    } finally {
      client.release();
    }
  }

  async storeEmbedding(key: string, embedding: number[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Extract metadata from key (format: "issue-123" or "pr-456")
      const [itemType, itemNumber] = key.split('-');
      
      await client.query(
        `INSERT INTO prism_embeddings (key, item_number, item_type, title, url, embedding)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key) DO UPDATE
         SET embedding = $6, created_at = NOW()`,
        [key, parseInt(itemNumber), itemType, '', '', JSON.stringify(embedding)]
      );
    } finally {
      client.release();
    }
  }

  async getEmbedding(key: string): Promise<number[] | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT embedding FROM prism_embeddings WHERE key = $1',
        [key]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].embedding;
    } finally {
      client.release();
    }
  }

  async findSimilar(
    embedding: number[],
    threshold: number,
    limit: number
  ): Promise<SimilarItem[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT 
           item_number as number,
           title,
           url,
           item_type as type,
           1 - (embedding <=> $1::vector) as similarity
         FROM prism_embeddings
         WHERE 1 - (embedding <=> $1::vector) >= $2
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [JSON.stringify(embedding), threshold, limit]
      );

      return result.rows.map(row => ({
        number: row.number,
        title: row.title,
        url: row.url,
        similarity: row.similarity,
        type: row.type as 'issue' | 'pr',
      }));
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Factory function to create storage backend based on configuration
 */
export function createStorage(databaseUrl?: string): StorageBackend {
  if (databaseUrl && databaseUrl.trim() !== '') {
    return new PostgresStorage(databaseUrl);
  }
  return new MemoryStorage();
}
