// Project Management Types - Compatible with BigMemory

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: Date;
  dueDate?: Date;
  owner?: string;
  team?: string[];
  ministry?: string;
  progress?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Subtask {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee?: string;
  dueDate?: Date;
  completedAt?: Date;
  createdAt?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt?: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  ministry?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  subtasks?: Subtask[];
  todoList?: TodoItem[];
}

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: DependencyType;
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  BLOCKED = 'blocked',
  DONE = 'done',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum DependencyType {
  BLOCKS = 'blocks',
  DEPENDS_ON = 'depends_on',
  RELATED = 'related'
}

export interface ProjectSearchParams {
  status?: ProjectStatus;
  owner?: string;
  team?: string;
  ministry?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  searchTerm?: string;
  includeCompleted?: boolean;
}

export interface TaskSearchParams {
  projectId?: string;
  status?: TaskStatus;
  assignee?: string;
  priority?: TaskPriority;
  ministry?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  searchTerm?: string;
  includeCompleted?: boolean;
}

// Memory metadata structure for projects/tasks
export interface ProjectMetadata {
  type: 'project';
  status: ProjectStatus;
  startDate?: Date;
  dueDate?: Date;
  owner?: string;
  team?: string[];
  ministry?: string;
  progress?: number;
  [key: string]: any;
}

export interface TaskMetadata {
  type: 'task';
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string;
  assignee?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  ministry?: string;
  subtasks?: Subtask[];
  todoList?: TodoItem[];
  dependencies?: string[]; // Memory IDs of dependent tasks
  [key: string]: any;
}

export type ProjectManagementMetadata = ProjectMetadata | TaskMetadata;