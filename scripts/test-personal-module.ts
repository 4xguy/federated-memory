import './register-paths';
import { PersonalModule } from '../src/modules/personal';
import { prisma } from '../src/utils/database';
import { Logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

async function testPersonalModule() {
  const testUserId = uuidv4();
  const personalModule = new PersonalModule();

  try {
    logger.info('Starting Personal Module tests...');

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
    await personalModule.initialize();
    logger.info('✓ Module initialized');

    // Test 1: Store a preference memory
    logger.info('\nTest 1: Storing preference memory...');
    const preferenceMemoryId = await personalModule.store(
      testUserId,
      'I love hiking in the mountains on weekends. My favorite trail is the one near Mount Wilson.',
      {
        category: 'preferences',
        emotional_valence: 0.8,
        importance: 0.7
      }
    );
    logger.info(`✓ Stored preference memory: ${preferenceMemoryId}`);

    // Test 2: Store an experience memory
    logger.info('\nTest 2: Storing experience memory...');
    const experienceMemoryId = await personalModule.store(
      testUserId,
      'Last summer, I went on a trip to Japan with my friend Sarah. We visited Tokyo and Kyoto, and it was an amazing experience.',
      {
        related_people: ['Sarah'],
        life_period: 'Summer 2023'
      }
    );
    logger.info(`✓ Stored experience memory: ${experienceMemoryId}`);

    // Test 3: Store a goal memory
    logger.info('\nTest 3: Storing goal memory...');
    const goalMemoryId = await personalModule.store(
      testUserId,
      'I want to learn Spanish fluently within the next two years. This is important for my career development.',
      {
        category: 'goals',
        importance: 0.9
      }
    );
    logger.info(`✓ Stored goal memory: ${goalMemoryId}`);

    // Test 4: Store a relationship memory
    logger.info('\nTest 4: Storing relationship memory...');
    const relationshipMemoryId = await personalModule.store(
      testUserId,
      'My sister Emily is getting married next month. She has been with her partner David for 5 years.',
      {
        category: 'relationships',
        related_people: ['Emily', 'David']
      }
    );
    logger.info(`✓ Stored relationship memory: ${relationshipMemoryId}`);

    // Test 5: Search for hiking-related memories
    logger.info('\nTest 5: Searching for hiking memories...');
    const hikingResults = await personalModule.search(testUserId, 'hiking mountains outdoor activities', {
      limit: 5
    });
    logger.info(`✓ Found ${hikingResults.length} hiking-related memories`);
    hikingResults.forEach((result, i) => {
      const searchResult = result as any;
      logger.info(`  ${i + 1}. Score: ${searchResult.score?.toFixed(3) || 'N/A'} - ${result.content.substring(0, 100)}...`);
    });

    // Test 6: Search for memories about people
    logger.info('\nTest 6: Searching for memories about people...');
    const peopleResults = await personalModule.search(testUserId, 'friends family relationships people', {
      limit: 5
    });
    logger.info(`✓ Found ${peopleResults.length} people-related memories`);
    peopleResults.forEach((result, i) => {
      const searchResult = result as any;
      logger.info(`  ${i + 1}. Score: ${searchResult.score?.toFixed(3) || 'N/A'} - ${result.content.substring(0, 100)}...`);
    });

    // Test 7: Analyze personal memories
    logger.info('\nTest 7: Analyzing personal memories...');
    const analysis = await personalModule.analyze(testUserId);
    logger.info('✓ Analysis complete:');
    logger.info(`  Total memories: ${analysis.total_memories}`);
    logger.info(`  Categories: ${JSON.stringify(analysis.categories)}`);
    logger.info(`  Emotional summary: ${JSON.stringify(analysis.emotional_summary)}`);
    logger.info(`  People network: ${JSON.stringify(analysis.people_network)}`);
    logger.info(`  Privacy distribution: ${JSON.stringify(analysis.privacy_distribution)}`);

    // Test 8: Update a memory
    logger.info('\nTest 8: Updating goal memory...');
    await personalModule.update(testUserId, goalMemoryId, {
      content: 'I want to learn Spanish fluently within the next two years. I have started taking online classes twice a week.',
      metadata: {
        category: 'goals',
        importance: 0.95,
        progress: 'Started classes'
      }
    });
    logger.info('✓ Memory updated');

    // Test 9: Test emotional content
    logger.info('\nTest 9: Storing emotional memories...');
    await personalModule.store(
      testUserId,
      'I felt really disappointed when I didn\'t get the promotion. It was frustrating after all the hard work.',
      {
        category: 'experiences',
        emotional_valence: -0.7
      }
    );
    await personalModule.store(
      testUserId,
      'Today was amazing! I got accepted into my dream graduate program. I\'m so excited and grateful!',
      {
        category: 'experiences',
        emotional_valence: 0.9
      }
    );
    logger.info('✓ Stored emotional memories');

    // Test 10: Search with category filter
    logger.info('\nTest 10: Analyzing goals category...');
    const goalsAnalysis = await personalModule.analyze(testUserId, { category: 'goals' });
    logger.info(`✓ Goals analysis: ${JSON.stringify(goalsAnalysis)}`);

    // Test 11: Delete a memory
    logger.info('\nTest 11: Deleting a memory...');
    await personalModule.delete(testUserId, relationshipMemoryId);
    logger.info('✓ Memory deleted');

    // Verify deletion
    const searchAfterDelete = await personalModule.search(testUserId, 'Emily David wedding', {
      limit: 5
    });
    logger.info(`  Memories found after deletion: ${searchAfterDelete.length}`);

    logger.info('\n✅ All Personal Module tests completed successfully!');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.personalMemory.deleteMany({
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
testPersonalModule().catch(console.error);