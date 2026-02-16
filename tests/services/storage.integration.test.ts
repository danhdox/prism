import { createStorage, MemoryStorage, PostgresStorage } from '../../src/services/storage';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const shouldRunStatefulTests = Boolean(testDatabaseUrl);
const vector = Array.from({ length: 1536 }, (_, i) => (i % 2 === 0 ? 0.01 : 0.02));

describe('Storage backend modes', () => {
  it('uses the memory backend when database URL is not configured', () => {
    const storage = createStorage('');
    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  it('uses the postgres backend when database URL is configured', () => {
    if (!shouldRunStatefulTests) {
      expect(testDatabaseUrl).toBeUndefined();
      return;
    }

    const storage = createStorage(testDatabaseUrl);
    expect(storage).toBeInstanceOf(PostgresStorage);
  });
});

(shouldRunStatefulTests ? describe : describe.skip)('Stateful PostgreSQL backend', () => {
  const storage = new PostgresStorage(testDatabaseUrl as string);
  const itemKey = `issue-${Math.floor(Date.now() / 1000)}`;

  beforeAll(async () => {
    await storage.initialize();
  });

  afterAll(async () => {
    await storage.close();
  });

  it('stores and retrieves an embedding through pgvector', async () => {
    await storage.storeEmbedding(itemKey, vector);
    const embedding = await storage.getEmbedding(itemKey);
    expect(embedding).toEqual(vector);
  });

  it('finds a similar vector once embeddings are stored', async () => {
    const similar = await storage.findSimilar(vector, 0.99, 10);
    expect(similar.length).toBeGreaterThanOrEqual(1);
    expect(similar[0]).toMatchObject({
      number: expect.any(Number),
      title: expect.any(String),
      url: expect.any(String),
      similarity: expect.any(Number),
      type: expect.stringMatching(/issue|pr/),
    });
  });
});
