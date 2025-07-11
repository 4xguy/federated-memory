import { Router } from 'express';
import { authMiddleware } from '@/api/middleware/auth';
import memoryRoutes from './memory.routes';
import moduleRoutes from './module.routes';
import userRoutes from './user.routes';
import healthRoutes from './health.routes';
import oauthRoutes from './oauth.routes';
import authRoutes from './auth.routes';
import { apiKeysRoutes } from '../routes/api-keys.routes';

const router = Router();

// Health routes (no auth required)
router.use('/health', healthRoutes);

// OAuth routes (mixed auth - some endpoints need session auth)
router.use('/oauth', oauthRoutes);

// Auth routes (for session management)
router.use('/auth', authRoutes);

// User routes (auth required only for some endpoints)
router.use('/users', userRoutes);

// Protected routes (auth required)
router.use('/memories', authMiddleware, memoryRoutes);
router.use('/modules', authMiddleware, moduleRoutes);

// API key management routes
router.use('/', apiKeysRoutes);

export default router;