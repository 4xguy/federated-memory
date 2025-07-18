const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Session middleware
app.use(session({
  secret: 'test-session-secret',
  resave: false,
  saveUninitialized: false,
}));

// Serve static test page
app.get('/test-oauth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-oauth.html'));
});

// Mock OAuth endpoints
app.get('/api/auth/google', (req, res) => {
  res.send(`
    <h2>Google OAuth Mock</h2>
    <p>In a real implementation, this would redirect to Google's OAuth page.</p>
    <p>Since we don't have real OAuth credentials configured, here's what would happen:</p>
    <ol>
      <li>Redirect to Google's OAuth consent screen</li>
      <li>User logs in with Google account</li>
      <li>Google redirects back to /api/auth/google/callback</li>
      <li>Server creates/updates user account</li>
      <li>Server generates JWT token</li>
      <li>User is redirected to frontend with token</li>
    </ol>
    <a href="/test-oauth.html">Back to test page</a>
  `);
});

app.get('/api/auth/github', (req, res) => {
  res.send(`
    <h2>GitHub OAuth Mock</h2>
    <p>In a real implementation, this would redirect to GitHub's OAuth page.</p>
    <p>Since we don't have real OAuth credentials configured, here's what would happen:</p>
    <ol>
      <li>Redirect to GitHub's OAuth authorization page</li>
      <li>User authorizes the app</li>
      <li>GitHub redirects back to /api/auth/github/callback</li>
      <li>Server creates/updates user account</li>
      <li>Server generates JWT token</li>
      <li>User is redirected to frontend with token</li>
    </ol>
    <a href="/test-oauth.html">Back to test page</a>
  `);
});

// Mock OAuth callbacks
app.get('/api/auth/google/callback', (req, res) => {
  // Simulate successful authentication
  const mockToken = 'mock-jwt-token-' + Date.now();
  res.redirect(`/test-oauth.html?token=${mockToken}&provider=google`);
});

app.get('/api/auth/github/callback', (req, res) => {
  // Simulate successful authentication
  const mockToken = 'mock-jwt-token-' + Date.now();
  res.redirect(`/test-oauth.html?token=${mockToken}&provider=github`);
});

// Mock user info endpoint
app.get('/api/auth/me', (req, res) => {
  res.json({
    id: 'mock-user-123',
    email: 'testuser@example.com',
    name: 'Test User',
    provider: 'mock',
    avatarUrl: null
  });
});

// Mock logout
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Mock MCP OAuth authorize endpoint
app.get('/api/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, state } = req.query;
  res.send(`
    <h2>MCP OAuth Authorization Mock</h2>
    <p>This simulates the MCP OAuth flow that Claude.ai would use.</p>
    <p><strong>Client ID:</strong> ${client_id}</p>
    <p><strong>Redirect URI:</strong> ${redirect_uri}</p>
    <p><strong>State:</strong> ${state}</p>
    <p>In a real implementation, this would redirect to Google/GitHub for authentication.</p>
    <button onclick="window.location.href='/api/auth/google'">Authenticate with Google</button>
    <button onclick="window.location.href='/api/auth/github'">Authenticate with GitHub</button>
  `);
});

app.listen(PORT, () => {
  console.log(`OAuth test server running at http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT}/test-oauth.html to test OAuth flows`);
  console.log(`\nNOTE: This is a mock server for testing the OAuth flow.`);
  console.log(`To test with real OAuth, you need to:`);
  console.log(`1. Set up Google OAuth credentials at https://console.cloud.google.com`);
  console.log(`2. Set up GitHub OAuth app at https://github.com/settings/developers`);
  console.log(`3. Update the .env file with real credentials`);
  console.log(`4. Run the full server with: npm run dev`);
});