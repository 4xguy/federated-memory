import './register-paths';
import { WorkModule } from '../src/modules/work';
import { prisma } from '../src/utils/database';
import { Logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

async function testWorkModule() {
  const testUserId = uuidv4();
  const workModule = new WorkModule();

  try {
    logger.info('Starting Work Module tests...');

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
    await workModule.initialize();
    logger.info('✓ Module initialized');

    // Test 1: Store a project memory
    logger.info('\nTest 1: Storing project memory...');
    const projectMemoryId = await workModule.store(
      testUserId,
      'Working on the new CRM integration project. Need to complete API design by end of week. Team includes @john.doe and @jane.smith.',
      {
        category: 'project',
        project_name: 'CRM Integration',
        priority: 'high',
        team_members: ['john.doe', 'jane.smith']
      }
    );
    logger.info(`✓ Stored project memory: ${projectMemoryId}`);

    // Test 2: Store a meeting memory
    logger.info('\nTest 2: Storing meeting memory...');
    const meetingMemoryId = await workModule.store(
      testUserId,
      'Sprint planning meeting notes: Discussed Q4 roadmap. Action items: 1. John will create technical spec 2. Jane to coordinate with design team. Next meeting Tuesday.',
      {
        category: 'meeting',
        meeting_type: 'planning',
        project_name: 'Q4 Roadmap'
      }
    );
    logger.info(`✓ Stored meeting memory: ${meetingMemoryId}`);

    // Test 3: Store a task memory
    logger.info('\nTest 3: Storing task memory...');
    const taskMemoryId = await workModule.store(
      testUserId,
      'URGENT: Fix production bug in payment processing. Customer reports intermittent failures. Need to investigate and deploy fix by tomorrow.',
      {
        tags: ['bug', 'production', 'payments']
      }
    );
    logger.info(`✓ Stored task memory: ${taskMemoryId}`);

    // Test 4: Store a documentation memory
    logger.info('\nTest 4: Storing documentation memory...');
    const docMemoryId = await workModule.store(
      testUserId,
      'Updated API documentation for v2.0 endpoints. Added examples for authentication flow and error handling. Review needed from @sarah.connor.',
      {
        category: 'documentation',
        project_name: 'API v2.0',
        status: 'in_progress'
      }
    );
    logger.info(`✓ Stored documentation memory: ${docMemoryId}`);

    // Test 5: Store a blocked task
    logger.info('\nTest 5: Storing blocked task...');
    const blockedMemoryId = await workModule.store(
      testUserId,
      'Database migration blocked - waiting for approval from security team. Cannot proceed with user data restructuring until cleared.',
      {
        category: 'task',
        status: 'blocked',
        priority: 'high',
        project_name: 'Database Migration'
      }
    );
    logger.info(`✓ Stored blocked task: ${blockedMemoryId}`);

    // Test 6: Search for project-related memories
    logger.info('\nTest 6: Searching for project memories...');
    const projectResults = await workModule.search(testUserId, 'project CRM integration API', {
      limit: 5
    });
    logger.info(`✓ Found ${projectResults.length} project-related memories`);
    projectResults.forEach((result, i) => {
      const searchResult = result as any;
      logger.info(`  ${i + 1}. Score: ${searchResult.score?.toFixed(3) || 'N/A'} - ${result.content.substring(0, 100)}...`);
    });

    // Test 7: Search for urgent items
    logger.info('\nTest 7: Searching for urgent items...');
    const urgentResults = await workModule.search(testUserId, 'urgent high priority deadline tomorrow', {
      limit: 5
    });
    logger.info(`✓ Found ${urgentResults.length} urgent items`);
    urgentResults.forEach((result, i) => {
      const searchResult = result as any;
      logger.info(`  ${i + 1}. Score: ${searchResult.score?.toFixed(3) || 'N/A'} - ${result.content.substring(0, 100)}...`);
    });

    // Test 8: Analyze work memories
    logger.info('\nTest 8: Analyzing work memories...');
    const analysis = await workModule.analyze(testUserId);
    logger.info('✓ Analysis complete:');
    logger.info(`  Total memories: ${analysis.total_memories}`);
    logger.info(`  Categories: ${JSON.stringify(analysis.categories)}`);
    logger.info(`  Priority breakdown: ${JSON.stringify(analysis.priority_breakdown)}`);
    logger.info(`  Status summary: ${JSON.stringify(analysis.status_summary)}`);
    logger.info(`  Active projects: ${analysis.active_projects.length}`);
    analysis.active_projects.forEach((project: any) => {
      logger.info(`    - ${project.name}: ${project.taskCount} tasks, ${project.teamSize} team members`);
    });
    logger.info(`  Team collaboration: ${JSON.stringify(analysis.team_collaboration)}`);
    logger.info(`  Blocked items: ${analysis.blocked_items.length}`);

    // Test 9: Store a planning memory
    logger.info('\nTest 9: Storing planning memory...');
    await workModule.store(
      testUserId,
      'Q1 2024 Planning: Focus on mobile app launch, improve API performance by 30%, hire 2 senior engineers. Budget allocated: $500k.',
      {
        category: 'planning',
        tags: ['strategy', 'Q1', '2024', 'hiring'],
        priority: 'high'
      }
    );
    logger.info('✓ Stored planning memory');

    // Test 10: Update task to completed
    logger.info('\nTest 10: Updating task status...');
    await workModule.update(testUserId, taskMemoryId, {
      metadata: {
        category: 'task',
        status: 'completed',
        priority: 'urgent',
        completion_percentage: 100,
        tags: ['bug', 'production', 'payments', 'resolved']
      }
    });
    logger.info('✓ Task marked as completed');

    // Test 11: Analyze by project
    logger.info('\nTest 11: Analyzing specific project...');
    const projectAnalysis = await workModule.analyze(testUserId, { 
      project: 'CRM Integration' 
    });
    logger.info(`✓ Project analysis: ${JSON.stringify(projectAnalysis)}`);

    // Test 12: Delete a memory
    logger.info('\nTest 12: Deleting a memory...');
    await workModule.delete(testUserId, blockedMemoryId);
    logger.info('✓ Memory deleted');

    // Verify deletion
    const searchAfterDelete = await workModule.search(testUserId, 'blocked migration security', {
      limit: 5
    });
    logger.info(`  Memories found after deletion: ${searchAfterDelete.length}`);

    logger.info('\n✅ All Work Module tests completed successfully!');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.workMemory.deleteMany({
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
testWorkModule().catch(console.error);