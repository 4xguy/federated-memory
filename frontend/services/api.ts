import axios, { AxiosInstance } from 'axios';
import { getSession } from 'next-auth/react';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Types for API responses
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PersonFilters {
  membershipStatus?: string[];
  ministries?: string[];
  tags?: string[];
  hasEmail?: boolean;
  hasPhone?: boolean;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  membershipStatus: 'visitor' | 'regular' | 'member';
  tags?: string[];
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  owner?: string;
  team?: string[];
  ministry?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  projectId?: string;
  dueDate?: string;
  ministry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Donation {
  id: string;
  amount: number;
  date: string;
  method: 'card' | 'ach' | 'cash' | 'check';
  fund: string;
  status: 'processed' | 'refunded';
  donorId: string;
  createdAt: string;
  updatedAt: string;
}

class FederatedMemoryAPI {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.axiosInstance.interceptors.request.use(async (config) => {
      const session = await getSession();
      
      // For now, create a temporary JWT token based on session
      // In production, this should be a real JWT from the backend
      if (session?.user) {
        // Create a basic auth token from the session
        const tempToken = btoa(JSON.stringify({
          userId: session.user.id || session.user.email,
          email: session.user.email,
          name: session.user.name,
        }));
        config.headers.Authorization = `Bearer temp-${tempToken}`;
      }
      
      return config;
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Memory operations
  async searchMemories(query: string, options?: SearchOptions) {
    const response = await this.axiosInstance.get('/v1/search', {
      params: { query, ...options },
    });
    return response.data;
  }

  async createMemory(content: string, metadata: any) {
    const response = await this.axiosInstance.post('/v1/memories', {
      content,
      metadata,
    });
    return response.data;
  }

  async getMemory(id: string) {
    const response = await this.axiosInstance.get(`/v1/memories/${id}`);
    return response.data;
  }

  async updateMemory(id: string, updates: { content?: string; metadata?: any }) {
    const response = await this.axiosInstance.put(`/v1/memories/${id}`, updates);
    return response.data;
  }

  async deleteMemory(id: string) {
    const response = await this.axiosInstance.delete(`/v1/memories/${id}`);
    return response.data;
  }

  // People operations
  async getPeople(filters?: PersonFilters, options?: SearchOptions) {
    const response = await this.axiosInstance.get('/v1/people', {
      params: { ...filters, ...options },
    });
    return response.data;
  }

  async createPerson(person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await this.axiosInstance.post('/v1/people', person);
    return response.data;
  }

  async getPerson(id: string) {
    const response = await this.axiosInstance.get(`/v1/people/${id}`);
    return response.data;
  }

  async updatePerson(id: string, updates: Partial<Person>) {
    const response = await this.axiosInstance.put(`/v1/people/${id}`, updates);
    return response.data;
  }

  async deletePerson(id: string) {
    const response = await this.axiosInstance.delete(`/v1/people/${id}`);
    return response.data;
  }

  async searchPeople(query: string, options?: SearchOptions) {
    const response = await this.axiosInstance.get('/v1/people/search', {
      params: { query, ...options },
    });
    return response.data;
  }

  // Projects operations
  async getProjects(filters?: any, options?: SearchOptions) {
    const response = await this.axiosInstance.get('/v1/projects', {
      params: { ...filters, ...options },
    });
    return response.data;
  }

  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await this.axiosInstance.post('/v1/projects', project);
    return response.data;
  }

  async getProject(id: string) {
    const response = await this.axiosInstance.get(`/v1/projects/${id}`);
    return response.data;
  }

  async updateProject(id: string, updates: Partial<Project>) {
    const response = await this.axiosInstance.put(`/v1/projects/${id}`, updates);
    return response.data;
  }

  async deleteProject(id: string) {
    const response = await this.axiosInstance.delete(`/v1/projects/${id}`);
    return response.data;
  }

  // Tasks operations
  async getTasks(filters?: any, options?: SearchOptions) {
    const response = await this.axiosInstance.get('/v1/tasks', {
      params: { ...filters, ...options },
    });
    return response.data;
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await this.axiosInstance.post('/v1/tasks', task);
    return response.data;
  }

  async getTask(id: string) {
    const response = await this.axiosInstance.get(`/v1/tasks/${id}`);
    return response.data;
  }

  async updateTask(id: string, updates: Partial<Task>) {
    const response = await this.axiosInstance.put(`/v1/tasks/${id}`, updates);
    return response.data;
  }

  async updateTaskStatus(id: string, status: Task['status']) {
    const response = await this.axiosInstance.patch(`/v1/tasks/${id}/status`, {
      status,
    });
    return response.data;
  }

  async deleteTask(id: string) {
    const response = await this.axiosInstance.delete(`/v1/tasks/${id}`);
    return response.data;
  }

  // Giving operations
  async getDonations(filters?: any, options?: SearchOptions) {
    const response = await this.axiosInstance.get('/v1/donations', {
      params: { ...filters, ...options },
    });
    return response.data;
  }

  async createDonation(donation: Omit<Donation, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await this.axiosInstance.post('/v1/donations', donation);
    return response.data;
  }

  async getDonation(id: string) {
    const response = await this.axiosInstance.get(`/v1/donations/${id}`);
    return response.data;
  }

  async updateDonation(id: string, updates: Partial<Donation>) {
    const response = await this.axiosInstance.put(`/v1/donations/${id}`, updates);
    return response.data;
  }

  async deleteDonation(id: string) {
    const response = await this.axiosInstance.delete(`/v1/donations/${id}`);
    return response.data;
  }

  // Analytics operations
  async getDashboardMetrics() {
    const response = await this.axiosInstance.get('/v1/analytics/dashboard');
    return response.data;
  }

  async getAttendanceAnalytics(startDate?: string, endDate?: string) {
    const response = await this.axiosInstance.get('/v1/analytics/attendance', {
      params: { startDate, endDate },
    });
    return response.data;
  }

  async getGivingAnalytics(startDate?: string, endDate?: string) {
    const response = await this.axiosInstance.get('/v1/analytics/giving', {
      params: { startDate, endDate },
    });
    return response.data;
  }

  // Real-time subscriptions (using Socket.io)
  subscribeToUpdates(callback: (data: any) => void) {
    // TODO: Implement Socket.io connection
    console.log('Real-time updates not yet implemented');
  }

  unsubscribeFromUpdates() {
    // TODO: Implement Socket.io disconnection
    console.log('Real-time updates not yet implemented');
  }
}

// Export singleton instance
export const api = new FederatedMemoryAPI();