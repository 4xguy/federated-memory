import { create } from 'zustand';
import { api } from '@/services/api';

interface DashboardMetrics {
  totalMembers: number;
  memberGrowth: number;
  weeklyAttendance: number;
  attendanceChange: number;
  totalGiving: number;
  givingChange: number;
  activeGroups: number;
  groupsChange: number;
}

interface Activity {
  id: string;
  type: 'new_member' | 'donation' | 'event' | 'checkin' | 'registration';
  description: string;
  timestamp: string;
  metadata?: any;
}

interface UpcomingEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  attendees: number;
  location?: string;
}

interface DashboardState {
  metrics: DashboardMetrics | null;
  recentActivity: Activity[];
  upcomingEvents: UpcomingEvent[];
  loading: boolean;
  error: string | null;
  refreshInterval: number;

  // Actions
  fetchDashboardData: () => Promise<void>;
  setRefreshInterval: (interval: number) => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

let refreshTimer: NodeJS.Timeout | null = null;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  metrics: null,
  recentActivity: [],
  upcomingEvents: [],
  loading: false,
  error: null,
  refreshInterval: 60000, // 1 minute default

  fetchDashboardData: async () => {
    set({ loading: true, error: null });

    try {
      // Fetch all dashboard data in parallel
      const [metricsResponse, activityResponse, eventsResponse] = await Promise.all([
        api.getDashboardMetrics(),
        api.searchMemories('type:activity', { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
        api.searchMemories('type:event AND date>now', { limit: 5, sortBy: 'date', sortOrder: 'asc' }),
      ]);

      // Transform the data
      const metrics: DashboardMetrics = {
        totalMembers: metricsResponse.data.totalMembers || 0,
        memberGrowth: metricsResponse.data.memberGrowth || 0,
        weeklyAttendance: metricsResponse.data.weeklyAttendance || 0,
        attendanceChange: metricsResponse.data.attendanceChange || 0,
        totalGiving: metricsResponse.data.totalGiving || 0,
        givingChange: metricsResponse.data.givingChange || 0,
        activeGroups: metricsResponse.data.activeGroups || 0,
        groupsChange: metricsResponse.data.groupsChange || 0,
      };

      const recentActivity: Activity[] = activityResponse.data.map((item: any) => ({
        id: item.id,
        type: item.metadata.activityType || 'event',
        description: item.content,
        timestamp: item.createdAt,
        metadata: item.metadata,
      }));

      const upcomingEvents: UpcomingEvent[] = eventsResponse.data.map((item: any) => ({
        id: item.id,
        name: item.metadata.name || 'Untitled Event',
        date: item.metadata.date,
        time: item.metadata.time,
        attendees: item.metadata.expectedAttendees || 0,
        location: item.metadata.location,
      }));

      set({
        metrics,
        recentActivity,
        upcomingEvents,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch dashboard data',
        loading: false,
      });
    }
  },

  setRefreshInterval: (interval) => {
    set({ refreshInterval: interval });
  },

  startAutoRefresh: () => {
    const { refreshInterval, fetchDashboardData } = get();
    
    // Clear any existing timer
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    // Start new timer
    refreshTimer = setInterval(() => {
      fetchDashboardData();
    }, refreshInterval);

    // Fetch immediately
    fetchDashboardData();
  },

  stopAutoRefresh: () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  },
}));