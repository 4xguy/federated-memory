// Re-export common types from API
export type {
  Person,
  PersonFilters,
  Project,
  Task,
  Donation,
  SearchOptions,
  ApiResponse,
} from '@/services/api';

// UI-specific types
export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: string;
  read: boolean;
}

export interface TableColumn<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => any);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: any; // Zod schema
}