import { create } from 'zustand';
import { api, Person, PersonFilters } from '@/services/api';

interface PeopleState {
  people: Person[];
  selectedPerson: Person | null;
  filters: PersonFilters;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  pageSize: number;

  // Actions
  fetchPeople: () => Promise<void>;
  searchPeople: (query: string) => Promise<void>;
  createPerson: (person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Person>;
  updatePerson: (id: string, updates: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  selectPerson: (person: Person | null) => void;
  setFilter: (key: keyof PersonFilters, value: any) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const usePeopleStore = create<PeopleState>((set, get) => ({
  people: [],
  selectedPerson: null,
  filters: {},
  searchQuery: '',
  loading: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,

  fetchPeople: async () => {
    const { filters, currentPage, pageSize } = get();
    set({ loading: true, error: null });

    try {
      const response = await api.getPeople(filters, {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      });

      set({
        people: response.data,
        totalCount: response.total,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch people',
        loading: false,
      });
    }
  },

  searchPeople: async (query: string) => {
    const { pageSize } = get();
    set({ loading: true, error: null, searchQuery: query });

    try {
      const response = await api.searchPeople(query, {
        limit: pageSize,
        offset: 0,
      });

      set({
        people: response.data,
        totalCount: response.total,
        currentPage: 1,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to search people',
        loading: false,
      });
    }
  },

  createPerson: async (person) => {
    set({ loading: true, error: null });

    try {
      const response = await api.createPerson(person);
      
      // Add new person to the list
      set((state) => ({
        people: [response.data, ...state.people],
        totalCount: state.totalCount + 1,
        loading: false,
      }));

      return response.data;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create person',
        loading: false,
      });
      throw error;
    }
  },

  updatePerson: async (id, updates) => {
    set({ loading: true, error: null });

    try {
      const response = await api.updatePerson(id, updates);
      
      // Update person in the list
      set((state) => ({
        people: state.people.map((p) =>
          p.id === id ? response.data : p
        ),
        selectedPerson:
          state.selectedPerson?.id === id ? response.data : state.selectedPerson,
        loading: false,
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update person',
        loading: false,
      });
      throw error;
    }
  },

  deletePerson: async (id) => {
    set({ loading: true, error: null });

    try {
      await api.deletePerson(id);
      
      // Remove person from the list
      set((state) => ({
        people: state.people.filter((p) => p.id !== id),
        selectedPerson: state.selectedPerson?.id === id ? null : state.selectedPerson,
        totalCount: state.totalCount - 1,
        loading: false,
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete person',
        loading: false,
      });
      throw error;
    }
  },

  selectPerson: (person) => {
    set({ selectedPerson: person });
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      currentPage: 1, // Reset to first page when filters change
    }));
    get().fetchPeople();
  },

  clearFilters: () => {
    set({ filters: {}, currentPage: 1 });
    get().fetchPeople();
  },

  setPage: (page) => {
    set({ currentPage: page });
    get().fetchPeople();
  },

  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 1 });
    get().fetchPeople();
  },
}));