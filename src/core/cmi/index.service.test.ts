import { CMIService } from './index.service';
import { PrismaClient } from '@prisma/client';
import { getEmbeddingService } from '@/core/embeddings/generator.service';
import { ModuleRegistry } from '@/core/modules/registry.service';
import { Redis } from '@/utils/redis';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('@/core/embeddings/generator.service');
jest.mock('@/core/modules/registry.service');
jest.mock('@/utils/redis');
jest.mock('@/utils/logger');

describe('CMIService', () => {
  let cmiService: CMIService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockEmbeddingService: jest.Mocked<ReturnType<typeof getEmbeddingService>>;
  let mockModuleRegistry: jest.Mocked<ModuleRegistry>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockPrisma = {
      memoryIndex: {
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
      },
      memoryRelationship: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $disconnect: jest.fn(),
    } as any;
    (PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma);

    mockEmbeddingService = {
      generateCompressedEmbedding: jest.fn(),
    } as any;
    (getEmbeddingService as jest.Mock).mockReturnValue(mockEmbeddingService);

    mockModuleRegistry = {} as any;
    (ModuleRegistry.getInstance as jest.Mock).mockReturnValue(mockModuleRegistry);

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;
    (Redis.getInstance as jest.Mock).mockReturnValue(mockRedis);

    cmiService = new CMIService();
  });

  describe('indexMemory', () => {
    const mockUserId = 'user-123';
    const mockModuleId = 'technical';
    const mockRemoteMemoryId = 'memory-456';
    const mockContent = 'Test memory content';
    const mockMetadata = {
      title: 'Test Memory',
      summary: 'This is a test memory',
      keywords: ['test', 'memory'],
      categories: ['testing'],
      importanceScore: 0.8,
    };
    const mockEmbedding = Array(512).fill(0).map(() => Math.random());

    it('should index a new memory', async () => {
      mockEmbeddingService.generateCompressedEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.memoryIndex.upsert.mockResolvedValue({
        id: 'index-123',
        userId: mockUserId,
        moduleId: mockModuleId,
        remoteMemoryId: mockRemoteMemoryId,
        embedding: mockEmbedding,
        ...mockMetadata,
        accessCount: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await cmiService.indexMemory(
        mockUserId,
        mockModuleId,
        mockRemoteMemoryId,
        mockContent,
        mockMetadata
      );

      expect(mockEmbeddingService.generateCompressedEmbedding).toHaveBeenCalledWith(
        `${mockMetadata.title} ${mockMetadata.summary} ${mockContent}`
      );
      expect(mockPrisma.memoryIndex.upsert).toHaveBeenCalledWith({
        where: {
          module_memory_unique: {
            moduleId: mockModuleId,
            remoteMemoryId: mockRemoteMemoryId,
          },
        },
        create: expect.objectContaining({
          userId: mockUserId,
          moduleId: mockModuleId,
          remoteMemoryId: mockRemoteMemoryId,
          embedding: mockEmbedding,
        }),
        update: expect.objectContaining({
          embedding: mockEmbedding,
          title: mockMetadata.title,
          summary: mockMetadata.summary,
        }),
      });
      expect(result).toBeDefined();
    });

    it('should handle indexing errors', async () => {
      mockEmbeddingService.generateCompressedEmbedding.mockRejectedValue(
        new Error('Embedding failed')
      );

      await expect(
        cmiService.indexMemory(
          mockUserId,
          mockModuleId,
          mockRemoteMemoryId,
          mockContent,
          mockMetadata
        )
      ).rejects.toThrow('Memory indexing failed');
    });
  });

  describe('routeQuery', () => {
    const mockUserId = 'user-123';
    const mockQuery = 'How to fix TypeScript errors';
    const mockEmbedding = Array(512).fill(0).map(() => Math.random());

    it('should route query to appropriate modules', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockEmbeddingService.generateCompressedEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          module_id: 'technical',
          avg_similarity: 0.85,
          matched_keywords: ['typescript', 'error'],
        },
        {
          module_id: 'learning',
          avg_similarity: 0.65,
          matched_keywords: ['programming'],
        },
      ]);

      const result = await cmiService.routeQuery(mockUserId, mockQuery);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        moduleId: 'technical',
        confidence: 0.85,
        keywords: ['typescript', 'error'],
      });
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should use cached routing if available', async () => {
      const cachedRouting = JSON.stringify([
        { moduleId: 'technical', confidence: 0.9, keywords: ['cached'] },
      ]);
      mockRedis.get.mockResolvedValue(cachedRouting);

      const result = await cmiService.routeQuery(mockUserId, mockQuery);

      expect(result).toEqual(JSON.parse(cachedRouting));
      expect(mockEmbeddingService.generateCompressedEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('searchMemories', () => {
    const mockUserId = 'user-123';
    const mockQuery = 'test search';
    const mockEmbedding = Array(512).fill(0).map(() => Math.random());

    it('should search memories across modules', async () => {
      mockEmbeddingService.generateCompressedEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          moduleId: 'technical',
          remoteMemoryId: 'mem-1',
          similarity: 0.9,
          title: 'Test Memory 1',
          summary: 'Summary 1',
          importanceScore: 0.8,
        },
        {
          moduleId: 'learning',
          remoteMemoryId: 'mem-2',
          similarity: 0.8,
          title: 'Test Memory 2',
          summary: 'Summary 2',
          importanceScore: 0.7,
        },
      ]);

      const result = await cmiService.searchMemories(mockUserId, mockQuery);

      expect(result).toHaveLength(2);
      expect(result[0].similarity).toBe(0.9);
      expect(mockPrisma.memoryIndex.update).toHaveBeenCalledTimes(2);
    });

    it('should filter by specific modules', async () => {
      mockEmbeddingService.generateCompressedEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await cmiService.searchMemories(mockUserId, mockQuery, ['technical', 'work']);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringMatching(/module_id = ANY/),
        ])
      );
    });
  });

  describe('createRelationship', () => {
    const mockUserId = 'user-123';
    const source = { moduleId: 'technical', memoryId: 'mem-1' };
    const target = { moduleId: 'learning', memoryId: 'mem-2' };

    it('should create relationship between memories', async () => {
      const mockRelationship = {
        id: 'rel-123',
        userId: mockUserId,
        sourceModule: source.moduleId,
        sourceMemoryId: source.memoryId,
        targetModule: target.moduleId,
        targetMemoryId: target.memoryId,
        relationshipType: 'related',
        strength: 0.8,
        metadata: {},
        createdAt: new Date(),
      };

      mockPrisma.memoryRelationship.create.mockResolvedValue(mockRelationship as any);

      const result = await cmiService.createRelationship(
        mockUserId,
        source,
        target,
        'related',
        0.8
      );

      expect(result).toEqual(mockRelationship);
      expect(mockPrisma.memoryRelationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          sourceModule: source.moduleId,
          sourceMemoryId: source.memoryId,
          targetModule: target.moduleId,
          targetMemoryId: target.memoryId,
          relationshipType: 'related',
          strength: 0.8,
        }),
      });
    });
  });

  describe('getRelatedMemories', () => {
    const mockUserId = 'user-123';
    const mockModuleId = 'technical';
    const mockMemoryId = 'mem-123';

    it('should get related memories', async () => {
      const mockRelated = [
        {
          id: 'rel-1',
          relationshipType: 'similar',
          strength: 0.9,
          memory: {
            moduleId: 'learning',
            remoteMemoryId: 'mem-456',
            title: 'Related Memory',
            summary: 'Related content',
            importanceScore: 0.7,
          },
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockRelated);

      const result = await cmiService.getRelatedMemories(
        mockUserId,
        mockModuleId,
        mockMemoryId
      );

      expect(result).toEqual(mockRelated);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('getModuleStats', () => {
    const mockUserId = 'user-123';

    it('should get module statistics', async () => {
      mockPrisma.memoryIndex.groupBy.mockResolvedValue([
        {
          moduleId: 'technical',
          _count: { id: 50 },
          _avg: { importanceScore: 0.75 },
          _sum: { accessCount: 250 },
        },
        {
          moduleId: 'learning',
          _count: { id: 30 },
          _avg: { importanceScore: 0.65 },
          _sum: { accessCount: 150 },
        },
      ] as any);

      const result = await cmiService.getModuleStats(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        moduleId: 'technical',
        memoryCount: 50,
        avgImportance: 0.75,
        totalAccess: 250,
      });
    });
  });

  describe('deleteMemory', () => {
    const mockModuleId = 'technical';
    const mockRemoteMemoryId = 'mem-123';

    it('should delete memory and its relationships', async () => {
      await cmiService.deleteMemory(mockModuleId, mockRemoteMemoryId);

      expect(mockPrisma.memoryRelationship.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { sourceModule: mockModuleId, sourceMemoryId: mockRemoteMemoryId },
            { targetModule: mockModuleId, targetMemoryId: mockRemoteMemoryId },
          ],
        },
      });

      expect(mockPrisma.memoryIndex.delete).toHaveBeenCalledWith({
        where: {
          module_memory_unique: {
            moduleId: mockModuleId,
            remoteMemoryId: mockRemoteMemoryId,
          },
        },
      });
    });
  });
});