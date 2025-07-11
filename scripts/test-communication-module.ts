import './register-paths';
import { CommunicationModule } from '../src/modules/communication';
import { prisma } from '../src/utils/database';
import { Logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getInstance();

async function testCommunicationModule() {
  const testUserId = uuidv4();
  const communicationModule = new CommunicationModule();

  try {
    logger.info('Starting Communication Module tests...');

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
    await communicationModule.initialize();
    logger.info('✓ Module initialized');

    // Test 1: Store an email communication
    logger.info('\nTest 1: Storing email communication...');
    const emailMemoryId = await communicationModule.store(
      testUserId,
      'Subject: Project Update\n\nDear Team,\n\nI wanted to update everyone on the project status. We have completed the first milestone ahead of schedule. Great work everyone!\n\nNext steps:\n- Review the deliverables by Friday\n- Schedule demo for stakeholders\n\nPlease let me know if you have any questions.\n\nBest regards,\nJohn Smith',
      {
        category: 'email',
        channel: 'email',
        sender: 'John Smith',
        participants: ['john.smith@example.com', 'team@example.com'],
        conversation_topic: 'Project Update'
      }
    );
    logger.info(`✓ Stored email memory: ${emailMemoryId}`);

    // Test 2: Store a meeting communication
    logger.info('\nTest 2: Storing meeting communication...');
    const meetingMemoryId = await communicationModule.store(
      testUserId,
      'Team Standup Meeting Notes\n\nAttendees: Sarah, Mike, Lisa, David\n\nDiscussion points:\n- Sarah completed API integration\n- Mike is blocked on database migration - needs DBA approval\n- Lisa will present design mockups tomorrow\n- David raised concern about timeline\n\nAction items:\n- Mike to follow up with DBA team\n- Lisa to share mockups before presentation\n\nNext meeting: Tomorrow 10 AM',
      {
        category: 'meeting',
        channel: 'zoom',
        participants: ['Sarah', 'Mike', 'Lisa', 'David'],
        thread_id: 'standup-2024-01'
      }
    );
    logger.info(`✓ Stored meeting memory: ${meetingMemoryId}`);

    // Test 3: Store a chat message
    logger.info('\nTest 3: Storing chat message...');
    const chatMemoryId = await communicationModule.store(
      testUserId,
      '@alice Hey, quick question - could you review the PR I just submitted? It\'s urgent as we need to deploy by EOD. Thanks!',
      {
        category: 'chat',
        channel: 'slack',
        sender: 'User',
        participants: ['alice'],
        response_required: true,
        tone: 'urgent'
      }
    );
    logger.info(`✓ Stored chat memory: ${chatMemoryId}`);

    // Test 4: Store a discussion thread
    logger.info('\nTest 4: Storing discussion thread...');
    const discussionMemoryId = await communicationModule.store(
      testUserId,
      'Discussion: Architecture Decision for New Service\n\nTeam, we need to decide between microservices vs monolithic approach for the new payment service. \n\nPros of microservices:\n- Better scalability\n- Independent deployment\n\nCons:\n- More complex\n- Higher operational overhead\n\nWhat are your thoughts? We need to make a decision by next week.',
      {
        category: 'discussion',
        channel: 'teams',
        thread_id: 'arch-decision-payment',
        conversation_topic: 'Architecture Decision'
      }
    );
    logger.info(`✓ Stored discussion memory: ${discussionMemoryId}`);

    // Test 5: Store a phone call summary
    logger.info('\nTest 5: Storing phone call summary...');
    const callMemoryId = await communicationModule.store(
      testUserId,
      'Call with client (ABC Corp) - Duration: 45 minutes\n\nDiscussed contract renewal terms. Client is happy with our service but wants 10% discount for 2-year commitment. They also requested additional support hours.\n\nAgreed to:\n- Send revised proposal with 7% discount\n- Include 20 additional support hours per month\n\nFollow up by Wednesday with formal proposal.',
      {
        category: 'call',
        channel: 'phone',
        participants: ['ABC Corp', 'Client Representative'],
        duration_minutes: 45,
        follow_up_needed: true,
        importance: 'high'
      }
    );
    logger.info(`✓ Stored call memory: ${callMemoryId}`);

    // Test 6: Search for urgent communications
    logger.info('\nTest 6: Searching for urgent communications...');
    const urgentResults = await communicationModule.search(testUserId, 'urgent review deploy EOD ASAP', {
      limit: 5
    });
    logger.info(`✓ Found ${urgentResults.length} urgent communications`);
    urgentResults.forEach((result, i) => {
      const searchResult = result as any;
      logger.info(`  ${i + 1}. Score: ${searchResult.score?.toFixed(3) || 'N/A'} - ${result.content.substring(0, 100)}...`);
    });

    // Test 7: Search for meeting-related communications
    logger.info('\nTest 7: Searching for meeting communications...');
    const meetingResults = await communicationModule.search(testUserId, 'meeting discussion attendees action items', {
      limit: 5
    });
    logger.info(`✓ Found ${meetingResults.length} meeting-related communications`);
    meetingResults.forEach((result, i) => {
      const metadata = result.metadata as any;
      logger.info(`  ${i + 1}. ${metadata.category || 'Unknown'} - ${metadata.channel || 'Unknown channel'}`);
    });

    // Test 8: Analyze communications
    logger.info('\nTest 8: Analyzing communications...');
    const analysis = await communicationModule.analyze(testUserId);
    logger.info('✓ Analysis complete:');
    logger.info(`  Total communications: ${analysis.total_communications}`);
    logger.info(`  Channels: ${JSON.stringify(analysis.channels)}`);
    logger.info(`  Sentiment summary: ${JSON.stringify(analysis.sentiment_summary)}`);
    logger.info(`  Tone distribution: ${JSON.stringify(analysis.tone_distribution)}`);
    logger.info(`  Active threads: ${analysis.active_threads.length}`);
    logger.info(`  Pending responses: ${analysis.pending_responses.length}`);
    logger.info(`  Follow-ups needed: ${analysis.follow_ups_needed.length}`);
    logger.info(`  Key decisions: ${analysis.key_decisions.length}`);
    logger.info(`  Top participants:`);
    analysis.participants_network.slice(0, 3).forEach((p: any) => {
      logger.info(`    - ${p.participant}: ${p.interactions} interactions`);
    });

    // Test 9: Store a negative sentiment communication
    logger.info('\nTest 9: Storing negative sentiment communication...');
    await communicationModule.store(
      testUserId,
      'I\'m really frustrated with the constant delays. This is the third time we\'ve had to push back the deadline. We need to have a serious discussion about project management and accountability.',
      {
        category: 'email',
        channel: 'email',
        sentiment: 'negative',
        tone: 'formal',
        follow_up_needed: true
      }
    );
    logger.info('✓ Stored negative sentiment communication');

    // Test 10: Update communication metadata
    logger.info('\nTest 10: Updating communication metadata...');
    await communicationModule.update(testUserId, chatMemoryId, {
      metadata: {
        category: 'chat',
        channel: 'slack',
        sender: 'User',
        participants: ['alice'],
        response_required: false,
        tone: 'urgent',
        response_received: true,
        response_time: '15 minutes'
      }
    });
    logger.info('✓ Updated communication metadata');

    // Test 11: Analyze by channel
    logger.info('\nTest 11: Analyzing email communications...');
    const emailAnalysis = await communicationModule.analyze(testUserId, { 
      channel: 'email' 
    });
    logger.info(`✓ Email analysis: ${emailAnalysis.total_communications} emails, sentiment: ${JSON.stringify(emailAnalysis.sentiment_summary)}`);

    // Test 12: Find communications needing response
    logger.info('\nTest 12: Finding communications needing response...');
    const needsResponse = await communicationModule.analyze(testUserId, { 
      needsResponse: true 
    });
    logger.info(`✓ Communications needing response: ${needsResponse.pending_responses.length}`);

    // Test 13: Delete a memory
    logger.info('\nTest 13: Deleting a memory...');
    await communicationModule.delete(testUserId, discussionMemoryId);
    logger.info('✓ Memory deleted');

    // Verify deletion
    const searchAfterDelete = await communicationModule.search(testUserId, 'architecture microservices monolithic', {
      limit: 5
    });
    logger.info(`  Memories found after deletion: ${searchAfterDelete.length}`);

    logger.info('\n✅ All Communication Module tests completed successfully!');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    await prisma.communicationMemory.deleteMany({
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
testCommunicationModule().catch(console.error);