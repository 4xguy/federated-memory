import { Router } from 'express';
import { authMiddleware, AuthRequest } from '@/api/middleware/auth';
import { AuthService } from '@/services/auth.service';
import { z } from 'zod';

const router = Router();
const authService = AuthService.getInstance();

// Schema validation
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// Get all API keys for the authenticated user
router.get('/keys', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const keys = await authService.listApiKeys(userId);
    res.json({ keys });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Create a new API key
router.post('/keys', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = createApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { name, expiresInDays } = validation.data;
    const key = await authService.generateApiKey(userId, name, expiresInDays);

    res.json({
      key,
      message: 'API key created successfully. Store it securely as it will not be shown again.',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Delete an API key
router.delete('/keys/:keyId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { keyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = await authService.revokeApiKey(userId, keyId);
    if (!success) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export const apiKeysRoutes = router;
