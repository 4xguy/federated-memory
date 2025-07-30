import { Router, Request, Response } from 'express';
import { authMiddleware } from '@/api/middleware/auth';
import { authMiddleware as authMiddlewareDev } from '@/api/middleware/auth-dev';
import { getChurchService, initializeServices } from './service-init';
import { ChurchQueries } from '@/api/mcp/church-queries';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const router = Router();

// Apply auth middleware to all routes
// Use development auth in development mode
const selectedAuthMiddleware = process.env.NODE_ENV === 'development' ? authMiddlewareDev : authMiddleware;
router.use(selectedAuthMiddleware);

// Initialize services on first request
let servicesInitialized = false;
const ensureServicesInitialized = async () => {
  if (!servicesInitialized) {
    await initializeServices();
    servicesInitialized = true;
  }
};

// Date range validation
const DateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET /api/v1/analytics/dashboard - Get dashboard metrics
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get various metrics in parallel
    const [
      peopleStats,
      projectStats,
      taskStats,
      recentActivity
    ] = await Promise.all([
      // People statistics
      ChurchQueries.getPeopleStats(userId),
      
      // Project statistics
      ChurchQueries.getProjectStats(userId),
      
      // Task statistics
      ChurchQueries.getTaskStats(userId),
      
      // Recent activity (last 10 items)
      // For now, return empty array - will implement activity tracking later
      Promise.resolve([]),
    ]);

    // Calculate growth percentages (mock data for now)
    const metrics = {
      totalMembers: peopleStats.total || 0,
      memberGrowth: 12, // Mock: +12% from last month
      weeklyAttendance: Math.floor((peopleStats.total || 0) * 0.4), // Mock: 40% attendance
      attendanceChange: 5, // Mock: +5% from last week
      totalGiving: 12345, // Mock data
      givingChange: 8, // Mock: +8% from last month
      activeGroups: 42, // Mock data
      groupsChange: 0, // Mock: No change
      activeProjects: projectStats.active || 0,
      completedTasks: taskStats.completed || 0,
      pendingTasks: taskStats.pending || 0,
    };

    res.json({
      data: metrics,
      recentActivity: recentActivity.map((activity: any) => ({
        id: activity.id,
        type: activity.metadata?.activityType || 'general',
        description: activity.content,
        timestamp: activity.createdAt,
        metadata: activity.metadata,
      })),
    });
  } catch (error: any) {
    logger.error('Error getting dashboard metrics', { error });
    res.status(500).json({ error: error.message || 'Failed to get dashboard metrics' });
  }
});

// GET /api/v1/analytics/attendance - Get attendance analytics
router.get('/attendance', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { startDate, endDate } = DateRangeSchema.parse(req.query);

    // For now, return mock attendance data
    // In a real implementation, this would query check-in records
    const mockData = {
      summary: {
        averageAttendance: 456,
        totalEvents: 12,
        growthRate: 5.2,
      },
      trends: [
        { date: '2024-01-07', attendance: 420, event: 'Sunday Service' },
        { date: '2024-01-14', attendance: 445, event: 'Sunday Service' },
        { date: '2024-01-21', attendance: 468, event: 'Sunday Service' },
        { date: '2024-01-28', attendance: 456, event: 'Sunday Service' },
      ],
      breakdown: {
        adults: 320,
        youth: 86,
        children: 50,
      },
    };

    res.json({ data: mockData });
  } catch (error: any) {
    logger.error('Error getting attendance analytics', { error });
    res.status(500).json({ error: error.message || 'Failed to get attendance analytics' });
  }
});

// GET /api/v1/analytics/giving - Get giving analytics
router.get('/giving', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { startDate, endDate } = DateRangeSchema.parse(req.query);

    // For now, return mock giving data
    // In a real implementation, this would query donation records
    const mockData = {
      summary: {
        totalGiving: 45678,
        averageGift: 125,
        totalDonors: 365,
        growthRate: 8.5,
      },
      trends: [
        { month: '2024-01', amount: 10234, donors: 342 },
        { month: '2024-02', amount: 11456, donors: 356 },
        { month: '2024-03', amount: 12345, donors: 365 },
      ],
      fundBreakdown: [
        { fund: 'General', amount: 30456, percentage: 67 },
        { fund: 'Missions', amount: 9123, percentage: 20 },
        { fund: 'Building', amount: 6099, percentage: 13 },
      ],
      methodBreakdown: {
        online: 28456,
        check: 10234,
        cash: 6988,
      },
    };

    res.json({ data: mockData });
  } catch (error: any) {
    logger.error('Error getting giving analytics', { error });
    res.status(500).json({ error: error.message || 'Failed to get giving analytics' });
  }
});

// GET /api/v1/analytics/groups - Get group analytics
router.get('/groups', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, return mock group data
    const mockData = {
      summary: {
        totalGroups: 42,
        activeGroups: 38,
        totalMembers: 456,
        averageSize: 12,
      },
      typeBreakdown: [
        { type: 'Small Groups', count: 18, members: 216 },
        { type: 'Bible Study', count: 8, members: 96 },
        { type: 'Youth Groups', count: 4, members: 80 },
        { type: 'Ministry Teams', count: 12, members: 64 },
      ],
      engagement: {
        weeklyMeetings: 35,
        monthlyAttendance: 89, // percentage
        growthRate: 3.2,
      },
    };

    res.json({ data: mockData });
  } catch (error: any) {
    logger.error('Error getting group analytics', { error });
    res.status(500).json({ error: error.message || 'Failed to get group analytics' });
  }
});

// GET /api/v1/analytics/ministries - Get ministry statistics
router.get('/ministries', async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const ministryStats = await ChurchQueries.getMinistryStats(userId);

    res.json({ data: ministryStats });
  } catch (error: any) {
    logger.error('Error getting ministry statistics', { error });
    res.status(500).json({ error: error.message || 'Failed to get ministry statistics' });
  }
});

export default router;