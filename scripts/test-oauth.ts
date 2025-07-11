import axios from 'axios';
import { AuthService } from '../src/services/auth.service';
import { OAuthProviderService } from '../src/services/oauth-provider.service';
import { prisma } from '../src/utils/database';

async function testOAuthFlow() {
  console.log('Testing OAuth Flow...\n');

  try {
    // 1. Create a test user (simulating Google/GitHub OAuth)
    console.log('1. Creating test OAuth user...');
    const authService = AuthService.getInstance();
    const user = await authService.findOrCreateOAuthUser({
      id: 'google_123456',
      email: 'oauth-test@example.com',
      name: 'OAuth Test User',
      avatar: 'https://example.com/avatar.jpg',
      provider: 'google'
    });
    console.log('✓ User created:', { id: user.id, email: user.email });

    // 2. Simulate OAuth authorization request
    console.log('\n2. Testing OAuth authorization...');
    const oauthProvider = OAuthProviderService.getInstance();
    
    try {
      const authResult = await oauthProvider.authorize({
        clientId: 'claude-desktop',
        redirectUri: 'claude-desktop://oauth/callback',
        scope: 'read write profile',
        state: 'test-state-123',
        userId: user.id
      });
      console.log('✓ Authorization code generated');
      console.log('  Redirect URL:', authResult.redirectUrl);

      // Extract code from redirect URL
      const url = new URL(authResult.redirectUrl);
      const code = url.searchParams.get('code');
      console.log('  Code:', code);

      // 3. Exchange code for token
      console.log('\n3. Exchanging code for token...');
      const tokenResult = await oauthProvider.token({
        grantType: 'authorization_code',
        code: code!,
        clientId: 'claude-desktop',
        clientSecret: 'development-secret',
        redirectUri: 'claude-desktop://oauth/callback'
      });
      console.log('✓ Token obtained:', {
        tokenType: tokenResult.tokenType,
        expiresIn: tokenResult.expiresIn,
        scope: tokenResult.scope,
        hasRefreshToken: !!tokenResult.refreshToken
      });

      // 4. Validate token
      console.log('\n4. Validating access token...');
      const validation = await oauthProvider.validateAccessToken(tokenResult.accessToken);
      console.log('✓ Token valid:', validation);

      // 5. Test API key generation
      console.log('\n5. Testing API key generation...');
      const apiKey = await authService.generateApiKey(user.id, 'Test API Key', 30);
      console.log('✓ API key generated:', apiKey.substring(0, 20) + '...');

      // 6. Validate API key
      console.log('\n6. Validating API key...');
      const apiKeyValidation = await authService.validateApiKey(apiKey);
      console.log('✓ API key valid:', apiKeyValidation);

      // 7. List user's API keys
      console.log('\n7. Listing user API keys...');
      const keys = await authService.listApiKeys(user.id);
      console.log('✓ API keys:', keys);

    } catch (error) {
      console.error('OAuth flow error:', error);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOAuthFlow();