import { Router } from 'express';
import peopleRoutes from './people.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

// Mount v1 routes
router.use('/people', peopleRoutes);
router.use('/analytics', analyticsRoutes);

// TODO: Add more routes as we implement them
// router.use('/projects', projectsRoutes);
// router.use('/tasks', tasksRoutes);
// router.use('/giving', givingRoutes);
// router.use('/checkins', checkinsRoutes);
// router.use('/registrations', registrationsRoutes);
// router.use('/groups', groupsRoutes);
// router.use('/calendar', calendarRoutes);

export default router;