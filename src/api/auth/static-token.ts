import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// Store tokens in memory (resets on server restart)
const staticTokens = new Map<string, { email: string; created: Date }>();

/**
 * ULTRA SIMPLE - Get a static token without ANY database interaction
 */
router.get('/static-token', (req, res) => {
  try {
    const token = randomUUID();
    const email = `user-${Date.now()}@static.local`;
    
    // Store in memory only
    staticTokens.set(token, {
      email,
      created: new Date()
    });
    
    const baseUrl = process.env.BASE_URL || 'https://federated-memory-production.up.railway.app';
    
    res.json({
      success: true,
      token,
      email,
      mcpUrl: `${baseUrl}/${token}/sse`,
      warning: 'This token is stored in memory only and will be lost on server restart'
    });
  } catch (error) {
    console.error('Static token error:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Validate a static token (for MCP auth)
 */
router.post('/validate-static', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Token required'
      });
    }
    
    const tokenData = staticTokens.get(token);
    
    if (tokenData) {
      res.json({
        valid: true,
        email: tokenData.email,
        created: tokenData.created
      });
    } else {
      res.status(401).json({
        valid: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Validate static token error:', error);
    res.status(500).json({
      error: 'Validation failed'
    });
  }
});

// Export the static tokens for use in other parts of the app
export { staticTokens };
export default router;