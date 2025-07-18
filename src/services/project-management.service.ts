import { ProjectManagementModule } from '@/modules/project-management/ProjectManagementModule';
import { 
  Project, 
  Task, 
  ProjectStatus, 
  TaskStatus, 
  TaskPriority,
  ProjectSearchParams,
  TaskSearchParams,
  TaskDependency,
  DependencyType,
  Subtask,
  TodoItem
} from '@/modules/project-management/types';
import { Memory } from '@/core/modules/interfaces';
import { v4 as uuidv4 } from 'uuid';
import RealtimeService from './realtime.service';

export class ProjectManagementService {
  private module: ProjectManagementModule;
  private cmiService: any;
  private realtimeService: RealtimeService;
  
  constructor(
    private embeddingService: any,
    cmiService: any
  ) {
    this.realtimeService = RealtimeService.getInstance();
    this.module = new ProjectManagementModule({
      id: 'project-management',
      name: 'Project Management',
      description: 'Manages projects, tasks, subtasks, and todo lists with ministry tracking',
      tableName: 'project_management_memories',
      metadata: {
        searchableFields: ['type', 'status', 'priority', 'assignee', 'ministry', 'projectId'],
        requiredFields: ['type'],
        indexedFields: ['type', 'status', 'priority']
      }
    }, embeddingService);
    
    this.cmiService = cmiService;
  }

  async initialize(): Promise<void> {
    await this.module.initialize();
  }

  // ============= Project Methods =============

  async createProject(userId: string, project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const projectId = uuidv4();
    const now = new Date();
    
    const fullProject: Project = {
      id: projectId,
      ...project,
      status: project.status || ProjectStatus.PLANNING,
      progress: project.progress || 0,
      createdAt: now,
      updatedAt: now
    };

    // Create content for the memory
    const content = `Project: ${fullProject.name}${fullProject.description ? '\n' + fullProject.description : ''}`;
    
    // Create metadata
    const metadata = {
      type: 'project',
      projectId,
      name: fullProject.name,
      status: fullProject.status,
      startDate: fullProject.startDate,
      dueDate: fullProject.dueDate,
      owner: fullProject.owner,
      team: fullProject.team,
      ministry: fullProject.ministry,
      progress: fullProject.progress,
      ...fullProject.metadata
    };

    // Store in module
    const memoryId = await this.module.store(userId, content, metadata);
    
    // Register with CMI for routing
    await this.cmiService.indexMemory(userId, 'project-management', memoryId, content, metadata);

    // Send real-time notification
    await this.realtimeService.notifyProjectChange(userId, 'created', fullProject);

    return fullProject;
  }

  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const projects = await this.module.searchByMetadata(userId, {
      type: 'project',
      projectId
    });

    if (projects.length === 0) return null;

    return this.memoryToProject(projects[0]);
  }

  async updateProject(userId: string, projectId: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project | null> {
    const memory = await this.findProjectMemory(userId, projectId);
    if (!memory) return null;

    const currentProject = this.memoryToProject(memory);
    const updatedProject = {
      ...currentProject,
      ...updates,
      updatedAt: new Date()
    };

    // Update content if name or description changed
    let content = memory.content;
    if (updates.name || updates.description !== undefined) {
      content = `Project: ${updatedProject.name}${updatedProject.description ? '\n' + updatedProject.description : ''}`;
    }

    // Update metadata
    const metadata = {
      ...memory.metadata,
      ...updates,
      type: 'project',
      projectId,
      updatedAt: new Date()
    };

    await this.module.update(userId, memory.id, { content, metadata });
    
    // Update CMI entry
    await this.cmiService.update(userId, memory.id, { content, metadata });

    return updatedProject;
  }

  async deleteProject(userId: string, projectId: string, deleteTasks: boolean = false): Promise<boolean> {
    const memory = await this.findProjectMemory(userId, projectId);
    if (!memory) return false;

    if (deleteTasks) {
      // Delete all tasks associated with this project
      const tasks = await this.getProjectTasks(userId, projectId);
      for (const task of tasks) {
        await this.deleteTask(userId, task.id);
      }
    }

    // Delete from module
    await this.module.delete(userId, memory.id);
    
    // Remove from CMI
    await this.cmiService.deleteMemory('project-management', memory.id);

    return true;
  }

  async searchProjects(userId: string, params: ProjectSearchParams): Promise<Project[]> {
    const memories = await this.module.searchProjects(userId, params);
    return memories.map(m => this.memoryToProject(m));
  }

  // ============= Task Methods =============

  async createTask(userId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const taskId = uuidv4();
    const now = new Date();
    
    const fullTask: Task = {
      id: taskId,
      ...task,
      status: task.status || TaskStatus.TODO,
      priority: task.priority || TaskPriority.MEDIUM,
      subtasks: task.subtasks || [],
      todoList: task.todoList || [],
      tags: task.tags || [],
      createdAt: now,
      updatedAt: now
    };

    // Create content for the memory
    const content = `Task: ${fullTask.title}${fullTask.description ? '\n' + fullTask.description : ''}`;
    
    // Create metadata
    const metadata = {
      type: 'task',
      taskId,
      title: fullTask.title,
      status: fullTask.status,
      priority: fullTask.priority,
      projectId: fullTask.projectId,
      assignee: fullTask.assignee,
      dueDate: fullTask.dueDate,
      estimatedHours: fullTask.estimatedHours,
      actualHours: fullTask.actualHours,
      ministry: fullTask.ministry,
      tags: fullTask.tags,
      subtasks: fullTask.subtasks,
      todoList: fullTask.todoList,
      ...fullTask.metadata
    };

    // Store in module
    const memoryId = await this.module.store(userId, content, metadata);
    
    // Register with CMI for routing
    await this.cmiService.indexMemory(userId, 'project-management', memoryId, content, metadata);

    return fullTask;
  }

  async getTask(userId: string, taskId: string): Promise<Task | null> {
    const tasks = await this.module.searchByMetadata(userId, {
      type: 'task',
      taskId
    });

    if (tasks.length === 0) return null;

    return this.memoryToTask(tasks[0]);
  }

  async updateTask(userId: string, taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | null> {
    const memory = await this.findTaskMemory(userId, taskId);
    if (!memory) return null;

    const currentTask = this.memoryToTask(memory);
    const updatedTask = {
      ...currentTask,
      ...updates,
      updatedAt: new Date()
    };

    // Update content if title or description changed
    let content = memory.content;
    if (updates.title || updates.description !== undefined) {
      content = `Task: ${updatedTask.title}${updatedTask.description ? '\n' + updatedTask.description : ''}`;
    }

    // Update metadata
    const metadata = {
      ...memory.metadata,
      ...updates,
      type: 'task',
      taskId,
      updatedAt: new Date()
    };

    await this.module.update(userId, memory.id, { content, metadata });
    
    // Update CMI entry
    await this.cmiService.update(userId, memory.id, { content, metadata });

    return updatedTask;
  }

  async deleteTask(userId: string, taskId: string): Promise<boolean> {
    const memory = await this.findTaskMemory(userId, taskId);
    if (!memory) return false;

    // Delete from module
    await this.module.delete(userId, memory.id);
    
    // Remove from CMI
    await this.cmiService.deleteMemory('project-management', memory.id);

    // Clean up dependencies
    await this.removeTaskDependencies(userId, taskId);

    return true;
  }

  async searchTasks(userId: string, params: TaskSearchParams): Promise<Task[]> {
    const memories = await this.module.searchTasks(userId, params);
    return memories.map(m => this.memoryToTask(m));
  }

  async getProjectTasks(userId: string, projectId: string): Promise<Task[]> {
    return this.searchTasks(userId, { projectId });
  }

  // ============= Task Dependencies =============

  async addTaskDependency(userId: string, taskId: string, dependsOnTaskId: string, type: DependencyType = DependencyType.DEPENDS_ON): Promise<boolean> {
    const taskMemory = await this.findTaskMemory(userId, taskId);
    const dependsOnMemory = await this.findTaskMemory(userId, dependsOnTaskId);
    
    if (!taskMemory || !dependsOnMemory) return false;

    // Add to CMI relationships
    await this.cmiService.createRelationship(
      userId,
      'project-management',
      taskMemory.id,
      'project-management',
      dependsOnMemory.id,
      type
    );

    // Update task metadata with dependency
    const dependencies = (taskMemory.metadata.dependencies || []) as string[];
    if (!dependencies.includes(dependsOnTaskId)) {
      dependencies.push(dependsOnTaskId);
      await this.module.update(userId, taskMemory.id, {
        metadata: {
          ...taskMemory.metadata,
          dependencies
        }
      });
    }

    return true;
  }

  async removeTaskDependency(userId: string, taskId: string, dependsOnTaskId: string): Promise<boolean> {
    const taskMemory = await this.findTaskMemory(userId, taskId);
    if (!taskMemory) return false;

    // Update task metadata to remove dependency
    const dependencies = ((taskMemory.metadata.dependencies || []) as string[]).filter(id => id !== dependsOnTaskId);
    await this.module.update(userId, taskMemory.id, {
      metadata: {
        ...taskMemory.metadata,
        dependencies
      }
    });

    return true;
  }

  async getTaskDependencies(userId: string, taskId: string): Promise<TaskDependency[]> {
    const taskMemory = await this.findTaskMemory(userId, taskId);
    if (!taskMemory) return [];

    const dependencies: TaskDependency[] = [];
    const dependencyIds = (taskMemory.metadata.dependencies || []) as string[];

    for (const depId of dependencyIds) {
      dependencies.push({
        taskId,
        dependsOnTaskId: depId,
        dependencyType: DependencyType.DEPENDS_ON
      });
    }

    return dependencies;
  }

  // ============= Subtask Management =============

  async addSubtask(userId: string, taskId: string, subtask: Omit<Subtask, 'id' | 'createdAt'>): Promise<Subtask | null> {
    const memory = await this.findTaskMemory(userId, taskId);
    if (!memory) return null;

    const newSubtask: Subtask = {
      id: uuidv4(),
      ...subtask,
      status: subtask.status || 'todo',
      createdAt: new Date().toISOString()
    };

    const subtasks = [...(memory.metadata.subtasks || []), newSubtask];
    
    await this.module.update(userId, memory.id, {
      metadata: {
        ...memory.metadata,
        subtasks
      }
    });

    return newSubtask;
  }

  async updateSubtask(userId: string, taskId: string, subtaskId: string, updates: Partial<Omit<Subtask, 'id' | 'createdAt'>>): Promise<Subtask | null> {
    const memory = await this.findTaskMemory(userId, taskId);
    if (!memory) return null;

    const subtasks = (memory.metadata.subtasks || []) as Subtask[];
    const subtaskIndex = subtasks.findIndex(st => st.id === subtaskId);
    
    if (subtaskIndex === -1) return null;

    subtasks[subtaskIndex] = {
      ...subtasks[subtaskIndex],
      ...updates
    };

    await this.module.update(userId, memory.id, {
      metadata: {
        ...memory.metadata,
        subtasks
      }
    });

    return subtasks[subtaskIndex];
  }

  // ============= Todo List Management =============

  async addTodoItem(userId: string, taskId: string, text: string): Promise<TodoItem | null> {
    const memory = await this.findTaskMemory(userId, taskId);
    if (!memory) return null;

    const newTodo: TodoItem = {
      id: uuidv4(),
      text,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const todoList = [...(memory.metadata.todoList || []), newTodo];
    
    await this.module.update(userId, memory.id, {
      metadata: {
        ...memory.metadata,
        todoList
      }
    });

    return newTodo;
  }

  async toggleTodoItem(userId: string, taskId: string, todoId: string): Promise<boolean> {
    const memory = await this.findTaskMemory(userId, taskId);
    if (!memory) return false;

    const todoList = (memory.metadata.todoList || []) as TodoItem[];
    const todoIndex = todoList.findIndex(t => t.id === todoId);
    
    if (todoIndex === -1) return false;

    todoList[todoIndex] = {
      ...todoList[todoIndex],
      completed: !todoList[todoIndex].completed,
      completedAt: todoList[todoIndex].completed ? undefined : new Date().toISOString()
    };

    await this.module.update(userId, memory.id, {
      metadata: {
        ...memory.metadata,
        todoList
      }
    });

    return true;
  }

  // ============= Helper Methods =============

  private async findProjectMemory(userId: string, projectId: string): Promise<Memory | null> {
    const memories = await this.module.searchByMetadata(userId, {
      type: 'project',
      projectId
    });
    return memories[0] || null;
  }

  private async findTaskMemory(userId: string, taskId: string): Promise<Memory | null> {
    const memories = await this.module.searchByMetadata(userId, {
      type: 'task',
      taskId
    });
    return memories[0] || null;
  }

  private memoryToProject(memory: Memory): Project {
    const metadata = memory.metadata;
    return {
      id: metadata.projectId,
      name: metadata.name,
      description: metadata.description,
      status: metadata.status,
      startDate: metadata.startDate ? new Date(metadata.startDate) : undefined,
      dueDate: metadata.dueDate ? new Date(metadata.dueDate) : undefined,
      owner: metadata.owner,
      team: metadata.team,
      ministry: metadata.ministry,
      progress: metadata.progress || 0,
      metadata: metadata,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt
    };
  }

  private memoryToTask(memory: Memory): Task {
    const metadata = memory.metadata;
    return {
      id: metadata.taskId,
      projectId: metadata.projectId,
      title: metadata.title,
      description: metadata.description,
      status: metadata.status,
      priority: metadata.priority,
      assignee: metadata.assignee,
      dueDate: metadata.dueDate ? new Date(metadata.dueDate) : undefined,
      estimatedHours: metadata.estimatedHours,
      actualHours: metadata.actualHours,
      ministry: metadata.ministry,
      tags: metadata.tags || [],
      subtasks: metadata.subtasks || [],
      todoList: metadata.todoList || [],
      metadata: metadata,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt
    };
  }

  private async removeTaskDependencies(userId: string, taskId: string): Promise<void> {
    // Remove this task from other tasks' dependencies
    const tasks = await this.module.searchByMetadata(userId, { type: 'task' });
    
    for (const task of tasks) {
      const dependencies = (task.metadata.dependencies || []) as string[];
      if (dependencies.includes(taskId)) {
        const updatedDeps = dependencies.filter(id => id !== taskId);
        await this.module.update(userId, task.id, {
          metadata: {
            ...task.metadata,
            dependencies: updatedDeps
          }
        });
      }
    }
  }

  // ============= Metadata Methods =============

  async getAssignees(userId: string): Promise<string[]> {
    const memories = await this.module.searchByMetadata(userId, { type: 'task' });
    const assignees = new Set<string>();
    
    for (const memory of memories) {
      if (memory.metadata.assignee) {
        assignees.add(memory.metadata.assignee);
      }
    }
    
    return Array.from(assignees).sort();
  }

  async getMinistries(userId: string): Promise<string[]> {
    const memories = await this.module.searchByMetadata(userId, {});
    const ministries = new Set<string>();
    
    for (const memory of memories) {
      if (memory.metadata.ministry) {
        ministries.add(memory.metadata.ministry);
      }
    }
    
    return Array.from(ministries).sort();
  }

  async getTags(userId: string): Promise<string[]> {
    const memories = await this.module.searchByMetadata(userId, { type: 'task' });
    const tags = new Set<string>();
    
    for (const memory of memories) {
      if (memory.metadata.tags && Array.isArray(memory.metadata.tags)) {
        for (const tag of memory.metadata.tags) {
          tags.add(tag);
        }
      }
    }
    
    return Array.from(tags).sort();
  }
}