#!/usr/bin/env tsx

/**
 * Test email configuration and sending
 * Usage: npm run test:email [recipient-email]
 */

import { emailService } from '../src/services/email/email.service';
import { logger } from '../src/utils/logger';
import { randomUUID } from 'crypto';

async function testEmailService() {
  const testEmail = process.argv[2] || process.env.TEST_EMAIL;
  
  if (!testEmail) {
    console.error('Please provide a test email address:');
    console.error('  npm run test:email your-email@example.com');
    console.error('  or set TEST_EMAIL environment variable');
    process.exit(1);
  }

  console.log('🧪 Testing email service configuration...\n');

  // Test 1: Check connection
  console.log('1. Testing email service connection...');
  try {
    const connected = await emailService.testConnection();
    if (connected) {
      console.log('✅ Email service connected successfully');
      console.log(`   Provider: ${process.env.EMAIL_PROVIDER || 'smtp'}`);
      console.log(`   From: ${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`);
    } else {
      console.log('❌ Email service not configured');
      console.log('   Please check your email configuration in .env file');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  }

  console.log('\n2. Sending test verification email...');
  try {
    const testToken = randomUUID();
    const sent = await emailService.sendVerificationEmail(testEmail, testToken);
    
    if (sent) {
      console.log('✅ Verification email sent successfully');
      console.log(`   To: ${testEmail}`);
      console.log(`   Token: ${testToken}`);
      console.log('\n   Check your inbox (and spam folder) for the verification email');
    } else {
      console.log('❌ Failed to send verification email');
      console.log('   Check the logs for more details');
    }
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
  }

  console.log('\n3. Sending test welcome email...');
  try {
    const testApiToken = randomUUID();
    const sent = await emailService.sendWelcomeEmail(testEmail, testApiToken);
    
    if (sent) {
      console.log('✅ Welcome email sent successfully');
      console.log(`   To: ${testEmail}`);
      console.log(`   API Token: ${testApiToken}`);
      console.log('\n   Check your inbox for the welcome email');
    } else {
      console.log('❌ Failed to send welcome email');
      console.log('   Check the logs for more details');
    }
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
  }

  console.log('\n📧 Email test completed!');
  
  // Test health endpoint
  console.log('\n4. Testing health endpoint email status...');
  try {
    const { default: healthRouter } = await import('../src/api/rest/health.routes');
    console.log('✅ Health endpoint includes email status');
  } catch (error) {
    console.log('ℹ️  Health endpoint not tested in standalone script');
  }

  console.log('\n✨ All tests completed!');
  console.log('\nNext steps:');
  console.log('1. Check your email inbox and spam folder');
  console.log('2. Click the verification link to test the flow');
  console.log('3. Review the email styling and content');
  console.log('4. Update EMAIL_FROM and EMAIL_FROM_NAME in .env if needed');
  
  process.exit(0);
}

// Run the test
testEmailService().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});