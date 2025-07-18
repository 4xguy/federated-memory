import axios from 'axios';

// Use environment variable or default to local development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies and reading custom headers
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('federated_memory_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Session ID is now handled via cookies automatically
  console.log('Request to:', config.url);
  
  return config;
});

// Log responses for debugging
api.interceptors.response.use((response) => {
  console.log('Response from:', response.config.url, 'Status:', response.status);
  // Session ID is now handled via cookies automatically
  return response;
}, (error) => {
  // Pass through errors
  return Promise.reject(error);
});

// API methods
export const authAPI = {
  // Register with email verification
  registerWithEmail: async (email: string, password: string, name?: string) => {
    const response = await api.post('/api/auth/register-email', { email, password, name });
    return response.data;
  },

  // Verify email with token
  verifyEmail: async (token: string) => {
    const response = await api.post('/api/auth/verify-email', { token });
    return response.data;
  },

  // Login with email and password
  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  // Get current user info
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  // Resend verification email
  resendVerification: async (email: string) => {
    const response = await api.post('/api/auth/resend-verification', { email });
    return response.data;
  },

  // Rotate token
  rotateToken: async (currentToken: string) => {
    const response = await api.post('/api/auth/rotate', { currentToken });
    return response.data;
  },

  // Validate token
  validateToken: async (token: string) => {
    const response = await api.post('/api/auth/validate', { token });
    return response.data;
  },

  // Deactivate account
  deactivateAccount: async () => {
    const response = await api.delete('/api/auth/deactivate');
    return response.data;
  },

  // Reactivate account
  reactivateAccount: async (email: string, password: string) => {
    const response = await api.post('/api/auth/reactivate', { email, password });
    return response.data;
  },
};

export const memoryAPI = {
  // Get memory stats
  getStats: async () => {
    const response = await api.get('/api/user/stats');
    return response.data;
  },

  // List memories
  listMemories: async (limit = 10, offset = 0) => {
    const response = await api.get(`/api/memories?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  // Create memory
  createMemory: async (data: { content: string; metadata?: any; moduleId?: string }) => {
    const response = await api.post('/api/memories', data);
    return response.data;
  },

  // Search memories
  searchMemories: async (query: string, moduleId?: string) => {
    const response = await api.post('/api/memories/search', { query, moduleId });
    return response.data;
  },
};

export const projectAPI = {
  // List projects with optional filters
  list: async (
    filters?: {
      status?: string;
      ministry?: string;
      owner?: string;
    },
    limit = 20,
    offset = 0
  ) => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      ...(filters || {}),
    });
    const response = await api.get(`/api/projects/projects?${params}`);
    return response.data;
  },

  // Create project
  create: async (data: {
    name: string;
    description?: string;
    status?: string;
    ministry?: string;
    owner?: string;
    team?: string[];
    startDate?: string;
    dueDate?: string;
  }) => {
    const response = await api.post('/api/projects/projects', data);
    return response.data;
  },

  // Get project by ID
  get: async (id: string) => {
    const response = await api.get(`/api/projects/projects/${id}`);
    return response.data;
  },

  // Update project
  update: async (id: string, data: any) => {
    const response = await api.put(`/api/projects/projects/${id}`, data);
    return response.data;
  },

  // Delete project
  delete: async (id: string) => {
    const response = await api.delete(`/api/projects/projects/${id}`);
    return response.data;
  },
};

export const taskAPI = {
  // List tasks
  list: async (filters?: any, limit = 20, offset = 0) => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      ...(filters || {}),
    });
    const response = await api.get(`/api/projects/tasks?${params}`);
    return response.data;
  },

  // Create task
  create: async (data: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    projectId?: string;
    assignee?: string;
    dueDate?: string;
  }) => {
    const response = await api.post('/api/projects/tasks', data);
    return response.data;
  },

  // Get task by ID
  get: async (id: string) => {
    const response = await api.get(`/api/projects/tasks/${id}`);
    return response.data;
  },

  // Update task
  update: async (id: string, data: any) => {
    const response = await api.put(`/api/projects/tasks/${id}`, data);
    return response.data;
  },

  // Delete task
  delete: async (id: string) => {
    const response = await api.delete(`/api/projects/tasks/${id}`);
    return response.data;
  },
};