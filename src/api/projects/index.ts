import { Router } from 'express';
import { ProjectManagementService } from '@/services/project-management.service';
import { getEmbeddingService } from '@/core/embeddings/generator.service';
import { getCMIService } from '@/core/cmi/index.service';
import { authMiddleware } from '@/api/middleware/auth';
import { 
  ProjectStatus, 
  TaskStatus, 
  TaskPriority, 
  ProjectSearchParams,
  TaskSearchParams,
  DependencyType
} from '@/modules/project-management/types';
import { z } from 'zod';

const router = Router();

// Initialize services
const embeddingService = getEmbeddingService();
const cmiService = getCMIService();
const projectService = new ProjectManagementService(embeddingService, cmiService);

// Validation schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  owner: z.string().optional(),
  team: z.array(z.string()).optional(),
  ministry: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  metadata: z.record(z.any()).optional()
});

const UpdateProjectSchema = CreateProjectSchema.partial();

const ProjectSearchSchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  owner: z.string().optional(),
  team: z.string().optional(),
  ministry: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  searchTerm: z.string().optional(),
  includeCompleted: z.boolean().optional().default(false)
});

const CreateTaskSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().positive().optional(),
  ministry: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const UpdateTaskSchema = CreateTaskSchema.partial();

const TaskSearchSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assignee: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  ministry: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  searchTerm: z.string().optional(),
  includeCompleted: z.boolean().optional().default(false)
});

const AddSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().optional()
});

const UpdateSubtaskSchema = AddSubtaskSchema.partial();

const AddTodoSchema = z.object({
  text: z.string().min(1).max(500)
});

const TaskDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
  dependencyType: z.nativeEnum(DependencyType).optional()
});

// Initialize service on router setup
router.use(authMiddleware);

// Async initialization
(async () => {
  await projectService.initialize();
})();

// ============= Project Routes =============

// Create project
router.post('/projects', async (req, res) => {
  try {
    const data = CreateProjectSchema.parse(req.body);
    const userId = req.user!.id;
    
    // Convert date strings to Date objects and provide defaults
    const projectData = {
      ...data,
      status: data.status || ProjectStatus.PLANNING,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    };

    const project = await projectService.createProject(userId, projectData);
    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get project by ID
router.get('/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;

    const project = await projectService.getProject(userId, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project
router.put('/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const data = UpdateProjectSchema.parse(req.body);
    const userId = req.user!.id;

    // Convert date strings to Date objects
    const updates = {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    };

    const project = await projectService.updateProject(userId, projectId, updates);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const deleteTasks = req.query.deleteTasks === 'true';

    const success = await projectService.deleteProject(userId, projectId, deleteTasks);
    if (!success) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search projects
router.get('/projects', async (req, res) => {
  try {
    const params = ProjectSearchSchema.parse(req.query);
    const userId = req.user!.id;

    // Convert date strings to Date objects
    const searchParams: ProjectSearchParams = {
      ...params,
      dueBefore: params.dueBefore ? new Date(params.dueBefore) : undefined,
      dueAfter: params.dueAfter ? new Date(params.dueAfter) : undefined
    };

    const projects = await projectService.searchProjects(userId, searchParams);
    res.json(projects);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      console.error('Error searching projects:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get project tasks
router.get('/projects/:id/tasks', async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;

    const tasks = await projectService.getProjectTasks(userId, projectId);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching project tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= Task Routes =============

// Create task
router.post('/tasks', async (req, res) => {
  try {
    const data = CreateTaskSchema.parse(req.body);
    const userId = req.user!.id;
    
    // Convert date strings to Date objects and provide defaults
    const taskData = {
      ...data,
      status: data.status || TaskStatus.TODO,
      priority: data.priority || TaskPriority.MEDIUM,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    };

    const task = await projectService.createTask(userId, taskData);
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get task by ID
router.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;

    const task = await projectService.getTask(userId, taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const data = UpdateTaskSchema.parse(req.body);
    const userId = req.user!.id;

    // Convert date strings to Date objects
    const updates = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    };

    const task = await projectService.updateTask(userId, taskId, updates);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete task
router.delete('/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;

    const success = await projectService.deleteTask(userId, taskId);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search tasks
router.get('/tasks', async (req, res) => {
  try {
    const params = TaskSearchSchema.parse(req.query);
    const userId = req.user!.id;

    // Convert date strings to Date objects
    const searchParams: TaskSearchParams = {
      ...params,
      dueBefore: params.dueBefore ? new Date(params.dueBefore) : undefined,
      dueAfter: params.dueAfter ? new Date(params.dueAfter) : undefined
    };

    const tasks = await projectService.searchTasks(userId, searchParams);
    res.json(tasks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      console.error('Error searching tasks:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// ============= Task Dependencies =============

// Add task dependency
router.post('/tasks/:id/dependencies', async (req, res) => {
  try {
    const taskId = req.params.id;
    const data = TaskDependencySchema.parse(req.body);
    const userId = req.user!.id;

    const success = await projectService.addTaskDependency(
      userId,
      taskId,
      data.dependsOnTaskId,
      data.dependencyType
    );

    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error adding task dependency:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get task dependencies
router.get('/tasks/:id/dependencies', async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;

    const dependencies = await projectService.getTaskDependencies(userId, taskId);
    res.json(dependencies);
  } catch (error) {
    console.error('Error fetching task dependencies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove task dependency
router.delete('/tasks/:id/dependencies/:dependencyId', async (req, res) => {
  try {
    const taskId = req.params.id;
    const dependencyId = req.params.dependencyId;
    const userId = req.user!.id;

    const success = await projectService.removeTaskDependency(userId, taskId, dependencyId);
    if (!success) {
      return res.status(404).json({ error: 'Task or dependency not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error removing task dependency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= Subtask Routes =============

// Add subtask
router.post('/tasks/:id/subtasks', async (req, res) => {
  try {
    const taskId = req.params.id;
    const data = AddSubtaskSchema.parse(req.body);
    const userId = req.user!.id;

    const subtaskData = {
      ...data,
      status: data.status || ('todo' as const),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    };

    const subtask = await projectService.addSubtask(userId, taskId, subtaskData);
    if (!subtask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(201).json(subtask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error adding subtask:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update subtask
router.put('/tasks/:id/subtasks/:subtaskId', async (req, res) => {
  try {
    const taskId = req.params.id;
    const subtaskId = req.params.subtaskId;
    const data = UpdateSubtaskSchema.parse(req.body);
    const userId = req.user!.id;

    const updates = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    };

    const subtask = await projectService.updateSubtask(userId, taskId, subtaskId, updates);
    if (!subtask) {
      return res.status(404).json({ error: 'Task or subtask not found' });
    }

    res.json(subtask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error updating subtask:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// ============= Todo List Routes =============

// Add todo item
router.post('/tasks/:id/todos', async (req, res) => {
  try {
    const taskId = req.params.id;
    const data = AddTodoSchema.parse(req.body);
    const userId = req.user!.id;

    const todo = await projectService.addTodoItem(userId, taskId, data.text);
    if (!todo) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(201).json(todo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      console.error('Error adding todo item:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Toggle todo item
router.put('/tasks/:id/todos/:todoId/toggle', async (req, res) => {
  try {
    const taskId = req.params.id;
    const todoId = req.params.todoId;
    const userId = req.user!.id;

    const success = await projectService.toggleTodoItem(userId, taskId, todoId);
    if (!success) {
      return res.status(404).json({ error: 'Task or todo item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling todo item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= Metadata Routes =============

// Get assignees
router.get('/metadata/assignees', async (req, res) => {
  try {
    const userId = req.user!.id;
    const assignees = await projectService.getAssignees(userId);
    res.json(assignees);
  } catch (error) {
    console.error('Error fetching assignees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ministries
router.get('/metadata/ministries', async (req, res) => {
  try {
    const userId = req.user!.id;
    const ministries = await projectService.getMinistries(userId);
    res.json(ministries);
  } catch (error) {
    console.error('Error fetching ministries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tags
router.get('/metadata/tags', async (req, res) => {
  try {
    const userId = req.user!.id;
    const tags = await projectService.getTags(userId);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;