'use client';

import React from 'react';
import { Layout } from '@/components/layout';
import { Card, Badge } from '@/components/common';
import {
  Users,
  Heart,
  Calendar,
  TrendingUp,
  UserCheck,
  DollarSign,
  Activity,
  Clock,
} from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
}) => {
  const changeColors = {
    increase: 'text-semantic-success',
    decrease: 'text-semantic-error',
    neutral: 'text-neutral-gray-600',
  };

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-gray-600">{title}</p>
          <p className="text-2xl font-bold text-neutral-gray-900 mt-1">
            {value}
          </p>
          {change && (
            <p className={`text-sm mt-2 ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        <div className="p-3 bg-primary-100 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600" />
        </div>
      </div>
    </Card>
  );
};

export default function DashboardPage() {
  // Mock data - in a real app, this would come from the API
  const metrics = [
    {
      title: 'Total Members',
      value: '1,234',
      change: '+12% from last month',
      changeType: 'increase' as const,
      icon: Users,
    },
    {
      title: 'Weekly Attendance',
      value: '456',
      change: '+5% from last week',
      changeType: 'increase' as const,
      icon: UserCheck,
    },
    {
      title: 'Total Giving',
      value: '$12,345',
      change: '+8% from last month',
      changeType: 'increase' as const,
      icon: DollarSign,
    },
    {
      title: 'Active Groups',
      value: '42',
      change: 'No change',
      changeType: 'neutral' as const,
      icon: Heart,
    },
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'new_member',
      description: 'John Doe joined as a new member',
      time: '2 hours ago',
    },
    {
      id: 2,
      type: 'donation',
      description: 'Anonymous donation of $500 received',
      time: '3 hours ago',
    },
    {
      id: 3,
      type: 'event',
      description: 'Youth Group Meeting scheduled for next week',
      time: '5 hours ago',
    },
    {
      id: 4,
      type: 'checkin',
      description: '25 children checked in for Sunday School',
      time: '1 day ago',
    },
  ];

  const upcomingEvents = [
    {
      id: 1,
      name: 'Sunday Service',
      date: 'Tomorrow',
      time: '10:00 AM',
      attendees: 450,
    },
    {
      id: 2,
      name: 'Youth Group Meeting',
      date: 'Wednesday',
      time: '6:00 PM',
      attendees: 35,
    },
    {
      id: 3,
      name: 'Bible Study',
      date: 'Thursday',
      time: '7:00 PM',
      attendees: 20,
    },
  ];

  return (
    <Layout activeSection="dashboard">
      <div className="space-y-lg">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-gray-900">
            Dashboard
          </h1>
          <p className="text-neutral-gray-600 mt-1">
            Welcome back! Here's what's happening in your church.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
          {metrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* Recent Activity */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-lg">
              <h2 className="text-lg font-semibold text-neutral-gray-900">
                Recent Activity
              </h2>
              <Activity className="w-5 h-5 text-neutral-gray-400" />
            </div>
            <div className="space-y-md">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-sm pb-md border-b border-neutral-gray-100 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <p className="text-sm text-neutral-gray-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-neutral-gray-500 mt-1">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Upcoming Events */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-lg">
              <h2 className="text-lg font-semibold text-neutral-gray-900">
                Upcoming Events
              </h2>
              <Calendar className="w-5 h-5 text-neutral-gray-400" />
            </div>
            <div className="space-y-md">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between pb-md border-b border-neutral-gray-100 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-gray-900">
                      {event.name}
                    </p>
                    <div className="flex items-center gap-sm mt-1">
                      <Clock className="w-3 h-3 text-neutral-gray-400" />
                      <p className="text-xs text-neutral-gray-500">
                        {event.date} at {event.time}
                      </p>
                    </div>
                  </div>
                  <Badge variant="info" size="sm">
                    {event.attendees} attendees
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-neutral-gray-900 mb-lg">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
            <button className="p-lg text-center rounded-lg border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors">
              <Users className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-gray-900">
                Add Person
              </p>
            </button>
            <button className="p-lg text-center rounded-lg border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors">
              <Calendar className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-gray-900">
                Create Event
              </p>
            </button>
            <button className="p-lg text-center rounded-lg border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors">
              <Heart className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-gray-900">
                Record Donation
              </p>
            </button>
            <button className="p-lg text-center rounded-lg border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors">
              <TrendingUp className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-gray-900">
                View Reports
              </p>
            </button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}