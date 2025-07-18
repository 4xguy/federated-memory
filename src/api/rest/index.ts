import { Router } from 'express';
import { authMiddleware } from '@/api/middleware/auth';
import memoryRoutes from './memory.routes';
import moduleRoutes from './module.routes';
import userRoutes from './user.routes';
import healthRoutes from './health.routes';
import oauthRoutes from './oauth.routes';
// REMOVED: authRoutes import (conflicting with new auth controller)
import mcpOauthRoutes from './mcp-oauth.routes';
import configRoutes from './config.routes';
import externalAuthRoutes from './external-auth.routes';
import projectRoutes from '../projects';
// New authentication controller (BigMemory pattern)
import authController from '../auth/auth.controller';
// TEMPORARY: Keep emergency auth for bypass
import emergencyAuthRoutes from '../auth/emergency-auth';

const router = Router();

// Health routes (no auth required)
router.use('/health', healthRoutes);

// Config routes are now handled at root level in index.ts
// router.use('/config', configRoutes);

// OAuth routes (mixed auth - some endpoints need session auth)
router.use('/oauth', oauthRoutes);

// MCP-specific OAuth discovery routes
router.use('/', mcpOauthRoutes);

// REMOVED: Auth routes (for session management) - conflicting with new auth controller
// router.use('/auth', authRoutes);

// External auth routes (Google/GitHub OAuth)
router.use('/auth', externalAuthRoutes);

// NEW: Authentication controller (BigMemory pattern)
// This provides /api/auth/login and /api/auth/register-email
router.use('/auth', authController);

// EMERGENCY AUTH ROUTES - TEMPORARY (for bypass authentication)
router.use('/auth', emergencyAuthRoutes);

// User routes (auth required only for some endpoints)
router.use('/users', userRoutes);

// Protected routes (auth required)
router.use('/memories', authMiddleware, memoryRoutes);
router.use('/modules', authMiddleware, moduleRoutes);
router.use('/', projectRoutes); // Project routes have their own auth middleware

// API key management routes - Deprecated with BigMemory auth
// router.use('/', apiKeysRoutes);

export default router;
