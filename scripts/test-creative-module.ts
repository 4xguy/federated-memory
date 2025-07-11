import './register-paths';
import { CreativeModule } from '../src/modules/creative';
import { prisma } from '../src/utils/database';
import { Logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

async function testCreativeModule() {
  const testUserId = uuidv4();
  const creativeModule = new CreativeModule();

  try {
    logger.info('Starting Creative Module tests...');

    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-${testUserId}@example.com`,
        token: `test-token-${testUserId}`
      }
    });
    logger.info('✓ Test user created');

    // Initialize module
    await creativeModule.initialize();
    logger.info('✓ Module initialized');

    // Test 1: Store a story idea
    logger.info('\nTest 1: Storing story idea...');
    const storyMemoryId = await creativeModule.store(
      testUserId,
      'Story idea: A world where memories can be traded like currency. The protagonist discovers they have a rare memory that everyone wants, but giving it away means losing a part of themselves forever.',
      {
        category: 'idea',
        genre: 'science fiction',
        themes: ['memory', 'identity', 'sacrifice', 'value'],
        mood: 'mysterious'
      }
    );
    logger.info(`✓ Stored story idea: ${storyMemoryId}`);

    // Test 2: Store a design concept
    logger.info('\nTest 2: Storing design concept...');
    const designMemoryId = await creativeModule.store(
      testUserId,
      'Design concept: Minimalist dashboard with dark mode. Primary colors: deep purple (#6B46C1) and electric blue (#3B82F6). Card-based layout with subtle shadows. Typography: Inter for UI, Fira Code for code blocks.',
      {
        category: 'design',
        medium: 'visual',
        style: 'minimalist',
        tools_used: ['Figma', 'Tailwind CSS'],
        stage: 'draft'
      }
    );
    logger.info(`✓ Stored design concept: ${designMemoryId}`);

    // Test 3: Store a writing draft
    logger.info('\nTest 3: Storing writing draft...');
    const writingMemoryId = await creativeModule.store(
      testUserId,
      'Chapter 1: The Digital Garden\n\nShe found the first anomaly in line 42 of her code. Not a bug, but a message, hidden in the comments like a flower pressed between pages...',
      {
        category: 'writing',
        genre: 'cyberpunk fiction',
        stage: 'draft',
        completion_percentage: 15,
        target_audience: 'young adults'
      }
    );
    logger.info(`✓ Stored writing draft: ${writingMemoryId}`);

    // Test 4: Store a brainstorming session
    logger.info('\nTest 4: Storing brainstorming session...');
    const brainstormMemoryId = await creativeModule.store(
      testUserId,
      'App ideas brainstorm:\n- AI-powered dream journal that generates art from descriptions\n- Collaborative story writing where each person can only see the previous paragraph\n- Music composition tool that translates emotions into melodies',
      {
        category: 'brainstorm',
        tags: ['app-ideas', 'AI', 'collaboration', 'creativity'],
        collaborators: ['Alex', 'Jordan']
      }
    );
    logger.info(`✓ Stored brainstorming session: ${brainstormMemoryId}`);

    // Test 5: Store an art concept
    logger.info('\nTest 5: Storing art concept...');
    const artMemoryId = await creativeModule.store(
      testUserId,
      'Digital art series: "Glitched Memories" - Corrupted photographs overlaid with generative patterns. Each piece represents how digital storage affects our perception of the past.',
      {
        category: 'art',
        medium: 'mixed',
        techniques: ['digital manipulation', 'generative art', 'photography'],
        stage: 'ideation',
        inspiration_sources: ['glitch art', 'vaporwave', 'data corruption']
      }
    );
    logger.info(`✓ Stored art concept: ${artMemoryId}`);

    // Test 6: Search for creative works
    logger.info('\nTest 6: Searching for creative works...');
    const searchResults = await creativeModule.search(testUserId, 'memory digital code art story', {
      limit: 5
    });
    logger.info(`✓ Found ${searchResults.length} creative works`);
    searchResults.forEach((result, i) => {
      const searchResult = result as any;
      logger.info(`  ${i + 1}. Score: ${searchResult.score?.toFixed(3) || 'N/A'} - ${result.content.substring(0, 100)}...`);
    });

    // Test 7: Search for specific medium
    logger.info('\nTest 7: Searching for visual works...');
    const visualResults = await creativeModule.search(testUserId, 'design color visual minimalist', {
      limit: 5
    });
    logger.info(`✓ Found ${visualResults.length} visual works`);
    visualResults.forEach((result, i) => {
      const metadata = result.metadata as any;
      logger.info(`  ${i + 1}. ${metadata.category || 'Unknown'} - ${metadata.medium || 'Unknown medium'}`);
    });

    // Test 8: Analyze creative portfolio
    logger.info('\nTest 8: Analyzing creative portfolio...');
    const analysis = await creativeModule.analyze(testUserId);
    logger.info('✓ Analysis complete:');
    logger.info(`  Total works: ${analysis.total_works}`);
    logger.info(`  Categories: ${JSON.stringify(analysis.categories_distribution)}`);
    logger.info(`  Media types: ${JSON.stringify(analysis.media_types)}`);
    logger.info(`  Stage distribution: ${JSON.stringify(analysis.stage_distribution)}`);
    logger.info(`  Quality average: ${(analysis.quality_overview.average * 100).toFixed(1)}%`);
    logger.info(`  Originality average: ${(analysis.originality_overview.average * 100).toFixed(1)}%`);
    logger.info(`  Top themes: ${Object.keys(analysis.themes_cloud).slice(0, 5).join(', ')}`);
    logger.info(`  Mood palette: ${JSON.stringify(analysis.mood_palette)}`);
    logger.info(`  Completion rates: ${(analysis.completion_rates.overall * 100).toFixed(1)}%`);

    // Test 9: Store a completed work
    logger.info('\nTest 9: Storing completed work...');
    await creativeModule.store(
      testUserId,
      'Haiku Collection:\n\nDigital sunrise—\npixels paint the morning sky\ncode becomes beauty\n\nEmpty terminal\nwaiting for inspiration\ncursor blinks, patient',
      {
        category: 'writing',
        genre: 'poetry/haiku',
        stage: 'final',
        quality_score: 0.85,
        originality_score: 0.7,
        completion_percentage: 100,
        public_visibility: 'public'
      }
    );
    logger.info('✓ Stored completed work');

    // Test 10: Update creative work progress
    logger.info('\nTest 10: Updating work progress...');
    await creativeModule.update(testUserId, writingMemoryId, {
      metadata: {
        category: 'writing',
        genre: 'cyberpunk fiction',
        stage: 'revision',
        completion_percentage: 45,
        target_audience: 'young adults',
        quality_score: 0.7,
        iterations: 3
      }
    });
    logger.info('✓ Updated work progress');

    // Test 11: Analyze by stage
    logger.info('\nTest 11: Analyzing draft stage works...');
    const draftAnalysis = await creativeModule.analyze(testUserId, { 
      stage: 'draft' 
    });
    logger.info(`✓ Draft analysis: ${draftAnalysis.total_works} works in draft stage`);

    // Test 12: Analyze high quality works
    logger.info('\nTest 12: Finding high quality works...');
    const qualityAnalysis = await creativeModule.analyze(testUserId, { 
      minQuality: 0.7 
    });
    logger.info(`✓ High quality works: ${qualityAnalysis.total_works}`);
    if (qualityAnalysis.top_works.length > 0) {
      logger.info(`  Top work: ${qualityAnalysis.top_works[0].content}`);
    }

    // Test 13: Delete a memory
    logger.info('\nTest 13: Deleting a memory...');
    await creativeModule.delete(testUserId, brainstormMemoryId);
    logger.info('✓ Memory deleted');

    // Verify deletion
    const searchAfterDelete = await creativeModule.search(testUserId, 'brainstorm app ideas', {
      limit: 5
    });
    logger.info(`  Memories found after deletion: ${searchAfterDelete.length}`);

    logger.info('\n✅ All Creative Module tests completed successfully!');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.creativeMemory.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.memoryIndex.deleteMany({
      where: { userId: testUserId }
    });
    await prisma.user.delete({
      where: { id: testUserId }
    }).catch(() => {}); // Ignore if already deleted
    await prisma.$disconnect();
  }
}

// Run tests
testCreativeModule().catch(console.error);