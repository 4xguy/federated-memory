import { EmbeddingService } from './generator.service';
import { OpenAI } from 'openai';
import { Redis } from '@/utils/redis';

// Mock dependencies
jest.mock('openai');
jest.mock('@/utils/redis');
jest.mock('@/utils/logger');
jest.mock('@prisma/client');

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup Redis mock
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    } as any;
    (Redis.getInstance as jest.Mock).mockReturnValue(mockRedis);

    // Setup OpenAI mock
    mockOpenAI = {
      embeddings: {
        create: jest.fn(),
      },
    } as any;
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    // Create service instance
    embeddingService = new EmbeddingService('test-api-key');
  });

  describe('generateEmbedding', () => {
    const testText = 'Test text for embedding';
    const testEmbedding = Array(1536)
      .fill(0)
      .map(() => Math.random());

    it('should generate embedding for text', async () => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: testEmbedding }],
      } as any);

      const result = await embeddingService.generateEmbedding(testText);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: testText,
        dimensions: undefined,
      });
      expect(result).toEqual(testEmbedding);
    });

    it('should use cached embedding if available', async () => {
      const cachedEmbedding = JSON.stringify(testEmbedding);
      mockRedis.get.mockResolvedValue(cachedEmbedding);

      const result = await embeddingService.generateEmbedding(testText);

      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
      expect(result).toEqual(testEmbedding);
    });

    it('should cache generated embedding', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: testEmbedding }],
      } as any);

      await embeddingService.generateEmbedding(testText);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('embedding:'),
        JSON.stringify(testEmbedding),
        3600 * 24,
      );
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.generateEmbedding(testText)).rejects.toThrow(
        'Embedding generation failed',
      );
    });
  });

  describe('generateBatchEmbeddings', () => {
    const testTexts = ['Text 1', 'Text 2', 'Text 3'];
    const testEmbeddings = testTexts.map(() =>
      Array(1536)
        .fill(0)
        .map(() => Math.random()),
    );

    it('should generate embeddings for multiple texts', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: testEmbeddings.map(embedding => ({ embedding })),
      } as any);

      const results = await embeddingService.generateBatchEmbeddings(testTexts);

      expect(results).toHaveLength(testTexts.length);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: testTexts,
        dimensions: undefined,
      });
    });

    it('should use cached embeddings when available', async () => {
      // First text is cached, others are not
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(testEmbeddings[0]))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: testEmbeddings[1] }, { embedding: testEmbeddings[2] }],
      } as any);

      const results = await embeddingService.generateBatchEmbeddings(testTexts);

      expect(results).toHaveLength(testTexts.length);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: ['Text 2', 'Text 3'],
        dimensions: undefined,
      });
    });
  });

  describe('dimension reduction', () => {
    it('should generate compressed embedding (512d)', async () => {
      const compressedEmbedding = Array(512)
        .fill(0)
        .map(() => Math.random());
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: compressedEmbedding }],
      } as any);

      const result = await embeddingService.generateCompressedEmbedding('test');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: 'test',
        dimensions: 512,
      });
      expect(result).toHaveLength(512);
    });

    it('should generate full embedding (1536d)', async () => {
      const fullEmbedding = Array(1536)
        .fill(0)
        .map(() => Math.random());
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: fullEmbedding }],
      } as any);

      const result = await embeddingService.generateFullEmbedding('test');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: 'test',
        dimensions: 1536,
      });
      expect(result).toHaveLength(1536);
    });

    it('should reduce dimensions of existing embedding', () => {
      const originalEmbedding = Array(1536)
        .fill(0)
        .map(() => Math.random());
      const reduced = embeddingService.reduceDimensions(originalEmbedding, 512);

      expect(reduced).toHaveLength(512);

      // Check normalization
      const magnitude = Math.sqrt(reduced.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1, 5);
    });
  });

  describe('similarity calculations', () => {
    it('should calculate cosine similarity correctly', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0];
      const embedding3 = [0, 1, 0];
      const embedding4 = [-1, 0, 0];

      expect(embeddingService.cosineSimilarity(embedding1, embedding2)).toBe(1);
      expect(embeddingService.cosineSimilarity(embedding1, embedding3)).toBe(0);
      expect(embeddingService.cosineSimilarity(embedding1, embedding4)).toBe(-1);
    });

    it('should find most similar embeddings', () => {
      const queryEmbedding = [1, 0, 0];
      const embeddings = [
        { id: '1', embedding: [1, 0, 0] }, // similarity: 1
        { id: '2', embedding: [0.8, 0.6, 0] }, // similarity: 0.8
        { id: '3', embedding: [0, 1, 0] }, // similarity: 0
        { id: '4', embedding: [-1, 0, 0] }, // similarity: -1
      ];

      const results = embeddingService.findMostSimilar(queryEmbedding, embeddings, 2);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: '1', similarity: 1 });
      expect(results[1].id).toBe('2');
      expect(results[1].similarity).toBeCloseTo(0.8, 5);
    });
  });

  describe('cache management', () => {
    it('should clear all embedding caches', async () => {
      mockRedis.keys.mockResolvedValue(['embedding:1', 'embedding:2']);

      await embeddingService.clearCache();

      expect(mockRedis.keys).toHaveBeenCalledWith('embedding:*');
      expect(mockRedis.del).toHaveBeenCalledWith('embedding:1', 'embedding:2');
    });
  });
});
