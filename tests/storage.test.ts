import { MemoryStorage } from '../src/services/storage';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should initialize without error', async () => {
    await expect(storage.initialize()).resolves.not.toThrow();
  });

  it('should store and retrieve embeddings', async () => {
    const key = 'test-key';
    const embedding = [0.1, 0.2, 0.3];

    await storage.storeEmbedding(key, embedding);
    const retrieved = await storage.getEmbedding(key);

    expect(retrieved).toEqual(embedding);
  });

  it('should return null for non-existent key', async () => {
    const retrieved = await storage.getEmbedding('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should overwrite existing embeddings', async () => {
    const key = 'test-key';
    const embedding1 = [0.1, 0.2, 0.3];
    const embedding2 = [0.4, 0.5, 0.6];

    await storage.storeEmbedding(key, embedding1);
    await storage.storeEmbedding(key, embedding2);
    const retrieved = await storage.getEmbedding(key);

    expect(retrieved).toEqual(embedding2);
  });

  it('should return empty array for findSimilar (stateless limitation)', async () => {
    const embedding = [0.1, 0.2, 0.3];
    const similar = await storage.findSimilar(embedding, 0.8, 10);
    expect(similar).toEqual([]);
  });
});
