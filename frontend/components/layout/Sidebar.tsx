import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Heart,
  UserCheck,
  ClipboardList,
  Users2,
  CalendarDays,
  Megaphone,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const pathname = usePathname();

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'Church Management',
      items: [
        {
          id: 'people',
          label: 'People',
          href: '/people',
          icon: Users,
          badge: '1,234',
        },
        {
          id: 'services',
          label: 'Services',
          href: '/services',
          icon: Calendar,
        },
        {
          id: 'giving',
          label: 'Giving',
          href: '/giving',
          icon: Heart,
        },
        {
          id: 'checkins',
          label: 'Check-ins',
          href: '/checkins',
          icon: UserCheck,
        },
        {
          id: 'registrations',
          label: 'Registrations',
          href: '/registrations',
          icon: ClipboardList,
        },
        {
          id: 'groups',
          label: 'Groups',
          href: '/groups',
          icon: Users2,
          badge: '42',
        },
        {
          id: 'calendar',
          label: 'Calendar',
          href: '/calendar',
          icon: CalendarDays,
        },
        {
          id: 'publishing',
          label: 'Publishing',
          href: '/publishing',
          icon: Megaphone,
        },
      ],
    },
  ];

  const isActiveLink = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:relative inset-y-0 left-0 z-50 lg:z-0 w-60 bg-neutral-white border-r border-neutral-gray-200 transform transition-transform duration-200 lg:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between p-lg border-b border-neutral-gray-200">
            <span className="text-lg font-bold text-primary-600">
              Clauvin Memory
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-neutral-gray-100 transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-neutral-gray-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-lg overflow-y-auto">
            {navSections.map((section, index) => (
              <div key={section.title} className={index > 0 ? 'mt-lg' : ''}>
                <h3 className="text-xs font-semibold text-neutral-gray-400 uppercase tracking-wider mb-sm">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActiveLink(item.href);

                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={clsx(
                            'flex items-center gap-sm px-md py-sm rounded-lg text-sm transition-all',
                            isActive
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-neutral-gray-700 hover:bg-neutral-gray-100'
                          )}
                          onClick={onClose}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span
                              className={clsx(
                                'text-xs px-2 py-0.5 rounded-full',
                                isActive
                                  ? 'bg-primary-200 text-primary-800'
                                  : 'bg-neutral-gray-100 text-neutral-gray-600'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-lg border-t border-neutral-gray-200">
            <p className="text-xs text-neutral-gray-500">
              © 2025 Clauvin Memory
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};