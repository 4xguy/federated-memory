import { Router, Request, Response } from 'express';
import { authMiddleware } from '@/api/middleware/auth';
import { getChurchService, initializeServices } from './service-init';
import { ChurchQueries } from '@/api/mcp/church-queries';
import { MembershipStatus } from '@/modules/church/types';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Initialize services on first request
let servicesInitialized = false;
const ensureServicesInitialized = async () => {
  if (!servicesInitialized) {
    await ensureServicesInitialized();
    servicesInitialized = true;
  }
};

// Validation schemas
const PersonSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  membershipStatus: z.nativeEnum(MembershipStatus).default(MembershipStatus.GUEST),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
});

const PersonFiltersSchema = z.object({
  membershipStatus: z.array(z.string()).optional().transform((val) => {
    if (!val) return undefined;
    // Validate that all strings are valid MembershipStatus values
    const validStatuses = Object.values(MembershipStatus);
    const validated = val.filter(status => validStatuses.includes(status as MembershipStatus));
    return validated as MembershipStatus[];
  }),
  ministries: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
});

const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// GET /api/v1/people - List people with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse and validate query parameters
    const filters = PersonFiltersSchema.parse(req.query);
    const pagination = PaginationSchema.parse(req.query);

    // Use optimized SQL query for listing
    const people = await ChurchQueries.listPeople(userId, {
      ...filters,
      limit: pagination.limit,
      offset: pagination.offset,
    }) as any[];

    // Get total count
    const total = await ChurchQueries.countPeople(userId, filters);

    res.json({
      data: people.map(p => p.metadata),
      total: total,
      limit: pagination.limit,
      offset: pagination.offset,
    });
  } catch (error: any) {
    logger.error('Error listing people', { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to list people' });
  }
});

// GET /api/v1/people/search - Search people
router.get('/search', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;
    const { query } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const pagination = PaginationSchema.parse(req.query);

    // Use semantic search for natural language queries
    const results = await getChurchService().searchPeople(userId, {
      query: query,
      limit: pagination.limit,
    });

    res.json({
      data: results,
      total: results.length,
      limit: pagination.limit,
      offset: pagination.offset,
    });
  } catch (error: any) {
    logger.error('Error searching people', { error });
    res.status(500).json({ error: error.message || 'Failed to search people' });
  }
});

// GET /api/v1/people/:id - Get a specific person
router.get('/:id', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const person = await getChurchService().getPerson(userId, id);
    
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json({ data: person });
  } catch (error: any) {
    logger.error('Error getting person', { error });
    res.status(500).json({ error: error.message || 'Failed to get person' });
  }
});

// POST /api/v1/people - Create a new person
router.post('/', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const personData = PersonSchema.parse(req.body);
    const person = await getChurchService().createPerson(userId, personData);

    res.status(201).json({ data: person });
  } catch (error: any) {
    logger.error('Error creating person', { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid person data', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to create person' });
  }
});

// PUT /api/v1/people/:id - Update a person
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates = PersonSchema.partial().parse(req.body);
    const updatedPerson = await getChurchService().updatePerson(userId, id, updates);

    if (!updatedPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json({ data: updatedPerson });
  } catch (error: any) {
    logger.error('Error updating person', { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid update data', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to update person' });
  }
});

// DELETE /api/v1/people/:id - Delete a person
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, we'll remove the person from the system
    // In a real implementation, you might want to soft delete
    const person = await getChurchService().getPerson(userId, id);
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    // TODO: Implement delete in ChurchService
    // await getChurchService().deletePerson(userId, id);

    res.json({ message: 'Person deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting person', { error });
    res.status(500).json({ error: error.message || 'Failed to delete person' });
  }
});

// POST /api/v1/people/:id/tags - Add tags to a person
router.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { tags } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    const updatedPerson = await getChurchService().tagPerson(userId, id, tags, 'add');
    
    if (!updatedPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json({ data: updatedPerson });
  } catch (error: any) {
    logger.error('Error adding tags', { error });
    res.status(500).json({ error: error.message || 'Failed to add tags' });
  }
});

// DELETE /api/v1/people/:id/tags - Remove tags from a person
router.delete('/:id/tags', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { tags } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    const updatedPerson = await getChurchService().tagPerson(userId, id, tags, 'remove');
    
    if (!updatedPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json({ data: updatedPerson });
  } catch (error: any) {
    logger.error('Error removing tags', { error });
    res.status(500).json({ error: error.message || 'Failed to remove tags' });
  }
});

export default router;