import './register-paths';
import { LearningModule } from '../src/modules/learning';
import { prisma } from '../src/utils/database';
import { Logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

async function testLearningModule() {
  const testUserId = uuidv4();
  const learningModule = new LearningModule();

  try {
    logger.info('Starting Learning Module tests...');

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
    await learningModule.initialize();
    logger.info('✓ Module initialized');

    // Test 1: Store a concept memory
    logger.info('\nTest 1: Storing concept memory...');
    const conceptMemoryId = await learningModule.store(
      testUserId,
      'JavaScript Promises: A Promise is an object representing the eventual completion or failure of an asynchronous operation. Key concepts include resolve, reject, then, catch, and finally.',
      {
        category: 'concept',
        subject: 'JavaScript',
        topics: ['Promises', 'Async Programming', 'Error Handling'],
        difficulty: 'intermediate'
      }
    );
    logger.info(`✓ Stored concept memory: ${conceptMemoryId}`);

    // Test 2: Store a tutorial memory
    logger.info('\nTest 2: Storing tutorial memory...');
    const tutorialMemoryId = await learningModule.store(
      testUserId,
      'How to implement a binary search tree in Python: Step 1: Create Node class with value, left, and right. Step 2: Implement insert method. Step 3: Add search functionality. Example code provided.',
      {
        category: 'tutorial',
        subject: 'Data Structures',
        difficulty: 'intermediate',
        resource_type: 'tutorial',
        progress: 'in_progress'
      }
    );
    logger.info(`✓ Stored tutorial memory: ${tutorialMemoryId}`);

    // Test 3: Store a question memory
    logger.info('\nTest 3: Storing question memory...');
    const questionMemoryId = await learningModule.store(
      testUserId,
      'Why does JavaScript have both null and undefined? What are the practical differences and when should I use each?',
      {
        subject: 'JavaScript',
        topics: ['null', 'undefined', 'types']
      }
    );
    logger.info(`✓ Stored question memory: ${questionMemoryId}`);

    // Test 4: Store a practice memory
    logger.info('\nTest 4: Storing practice memory...');
    const practiceMemoryId = await learningModule.store(
      testUserId,
      'Completed LeetCode problem: Two Sum. Used hash map approach for O(n) time complexity. Key insight: trade space for time by storing complements.',
      {
        category: 'practice',
        subject: 'Algorithms',
        difficulty: 'beginner',
        progress: 'completed',
        time_spent_minutes: 45
      }
    );
    logger.info(`✓ Stored practice memory: ${practiceMemoryId}`);

    // Test 5: Store a reflection memory
    logger.info('\nTest 5: Storing reflection memory...');
    const reflectionMemoryId = await learningModule.store(
      testUserId,
      'After studying React hooks for a week, I realize that useState and useEffect cover 80% of use cases. The key is understanding dependency arrays and cleanup functions.',
      {
        category: 'reflection',
        subject: 'React',
        progress: 'completed',
        understanding_level: 0.8,
        key_takeaways: [
          'useState and useEffect are fundamental',
          'Dependency arrays prevent infinite loops',
          'Always cleanup side effects'
        ]
      }
    );
    logger.info(`✓ Stored reflection memory: ${reflectionMemoryId}`);

    // Test 6: Search for JavaScript-related learning
    logger.info('\nTest 6: Searching for JavaScript learning...');
    const jsResults = await learningModule.search(testUserId, 'JavaScript async promises null undefined', {
      limit: 5
    });
    logger.info(`✓ Found ${jsResults.length} JavaScript-related memories`);
    jsResults.forEach((result, i) => {
      const searchResult = result as any;
      logger.info(`  ${i + 1}. Score: ${searchResult.score?.toFixed(3) || 'N/A'} - ${result.content.substring(0, 100)}...`);
    });

    // Test 7: Search for concepts to review
    logger.info('\nTest 7: Searching for concepts to review...');
    const reviewResults = await learningModule.search(testUserId, 'concept intermediate advanced review', {
      limit: 5
    });
    logger.info(`✓ Found ${reviewResults.length} concepts to review`);
    reviewResults.forEach((result, i) => {
      const searchResult = result as any;
      const metadata = result.metadata as any;
      logger.info(`  ${i + 1}. ${metadata.subject || 'Unknown'} - ${metadata.progress || 'Not started'}`);
    });

    // Test 8: Analyze learning progress
    logger.info('\nTest 8: Analyzing learning progress...');
    const analysis = await learningModule.analyze(testUserId);
    logger.info('✓ Analysis complete:');
    logger.info(`  Total memories: ${analysis.total_memories}`);
    logger.info(`  Subjects: ${JSON.stringify(analysis.subjects)}`);
    logger.info(`  Progress summary: ${JSON.stringify(analysis.progress_summary)}`);
    logger.info(`  Difficulty distribution: ${JSON.stringify(analysis.difficulty_distribution)}`);
    logger.info(`  Understanding overview: Average ${(analysis.understanding_overview.average * 100).toFixed(1)}%`);
    logger.info(`  Topics network: ${Object.keys(analysis.topics_network).slice(0, 5).join(', ')}`);
    logger.info(`  Pending questions: ${analysis.questions_pending.length}`);
    logger.info(`  Items needing review: ${analysis.review_items.length}`);

    // Test 9: Store an advanced concept
    logger.info('\nTest 9: Storing advanced concept...');
    await learningModule.store(
      testUserId,
      'Advanced TypeScript: Conditional types and mapped types enable powerful type transformations. Example: type Readonly<T> = { readonly [P in keyof T]: T[P] }',
      {
        category: 'concept',
        subject: 'TypeScript',
        difficulty: 'advanced',
        progress: 'in_progress',
        prerequisites: ['JavaScript', 'Basic TypeScript', 'Generics'],
        related_concepts: ['Type Inference', 'Utility Types', 'Template Literal Types']
      }
    );
    logger.info('✓ Stored advanced concept');

    // Test 10: Update progress on a concept
    logger.info('\nTest 10: Updating learning progress...');
    await learningModule.update(testUserId, conceptMemoryId, {
      metadata: {
        category: 'concept',
        subject: 'JavaScript',
        topics: ['Promises', 'Async Programming', 'Error Handling'],
        difficulty: 'intermediate',
        progress: 'completed',
        understanding_level: 0.85,
        last_reviewed: new Date().toISOString()
      }
    });
    logger.info('✓ Progress updated');

    // Test 11: Analyze by subject
    logger.info('\nTest 11: Analyzing JavaScript learning...');
    const jsAnalysis = await learningModule.analyze(testUserId, { 
      subject: 'JavaScript' 
    });
    logger.info(`✓ JavaScript analysis: ${JSON.stringify(jsAnalysis.subjects)}`);

    // Test 12: Get items needing review
    logger.info('\nTest 12: Finding items needing review...');
    const needsReview = await learningModule.analyze(testUserId, { 
      needsReview: true 
    });
    logger.info(`✓ Items needing review: ${needsReview.total_memories}`);

    // Test 13: Delete a memory
    logger.info('\nTest 13: Deleting a memory...');
    await learningModule.delete(testUserId, questionMemoryId);
    logger.info('✓ Memory deleted');

    // Verify deletion
    const searchAfterDelete = await learningModule.search(testUserId, 'null undefined differences', {
      limit: 5
    });
    logger.info(`  Memories found after deletion: ${searchAfterDelete.length}`);

    logger.info('\n✅ All Learning Module tests completed successfully!');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.learningMemory.deleteMany({
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
testLearningModule().catch(console.error);