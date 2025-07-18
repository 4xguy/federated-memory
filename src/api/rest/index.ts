import { Router } from 'express';
import { authMiddleware } from '@/api/middleware/auth';
import memoryRoutes from './memory.routes';
import moduleRoutes from './module.routes';
import userRoutes from './user.routes';
import healthRoutes from './health.routes';
import oauthRoutes from './oauth.routes';
import authRoutes from './auth.routes';
import mcpOauthRoutes from './mcp-oauth.routes';
import configRoutes from './config.routes';
import externalAuthRoutes from './external-auth.routes';
import projectRoutes from '../projects';
// TEMPORARY: Use temp auth until bcrypt issue is resolved
// import emailAuthRoutes from '../auth/email-auth';
import emailAuthRoutes from '../auth/email-auth-temp';
import emergencyAuthRoutes from '../auth/emergency-auth';
// import { apiKeysRoutes } from '../routes/api-keys.routes'; // Deprecated with BigMemory auth

const router = Router();

// Health routes (no auth required)
router.use('/health', healthRoutes);

// Config routes are now handled at root level in index.ts
// router.use('/config', configRoutes);

// OAuth routes (mixed auth - some endpoints need session auth)
router.use('/oauth', oauthRoutes);

// MCP-specific OAuth discovery routes
router.use('/', mcpOauthRoutes);

// Auth routes (for session management)
router.use('/auth', authRoutes);

// External auth routes (Google/GitHub OAuth)
router.use('/auth', externalAuthRoutes);

// Email authentication routes (email/password)
router.use('/auth', emailAuthRoutes);

// EMERGENCY AUTH ROUTES - TEMPORARY
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
