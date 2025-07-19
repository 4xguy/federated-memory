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
// New authentication controller (BigMemory pattern) - PRIORITY 1
import authController from '../auth/bigmemory-auth.controller';
// Emergency auth for bypass - PRIORITY 2 (fallback)
import emergencyAuthRoutes from '../auth/emergency-auth';
// V1 API routes for frontend
import v1Routes from './v1';

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

// AUTH ROUTES - ORGANIZED BY PRIORITY
// 1. BigMemory Authentication Controller (PRIMARY)
// This provides /api/auth/login and /api/auth/register-email
router.use('/auth', authController);

// 2. Emergency Auth Routes (FALLBACK)
// Only used when primary auth fails
router.use('/auth', emergencyAuthRoutes);

// 3. External Auth Routes (OAuth - Google/GitHub)
// These are for web OAuth flows, not API auth
router.use('/auth', externalAuthRoutes);

// User routes (auth required only for some endpoints)
router.use('/users', userRoutes);

// Protected routes (auth required)
router.use('/memories', authMiddleware, memoryRoutes);
router.use('/modules', authMiddleware, moduleRoutes);
router.use('/projects', projectRoutes); // Project routes have their own auth middleware

// API key management routes - Deprecated with BigMemory auth
// router.use('/', apiKeysRoutes);

// V1 API routes for frontend (mounted at /api/v1)
router.use('/v1', v1Routes);

export default router;
