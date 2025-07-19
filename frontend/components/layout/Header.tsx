import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, User, LogOut, Settings, Bell } from 'lucide-react';

export interface HeaderProps {
  variant?: 'default' | 'minimal';
  showUser?: boolean;
  activeSection?: string;
  onMenuClick?: () => void;
  userName?: string;
  userEmail?: string;
}

export const Header: React.FC<HeaderProps> = ({
  variant = 'default',
  showUser = true,
  activeSection,
  onMenuClick,
  userName = 'User',
  userEmail = 'user@example.com',
}) => {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const handleLogout = async () => {
    // TODO: Implement logout
    router.push('/login');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
    { id: 'people', label: 'People', href: '/people' },
    { id: 'services', label: 'Services', href: '/services' },
    { id: 'giving', label: 'Giving', href: '/giving' },
    { id: 'checkins', label: 'Check-ins', href: '/checkins' },
    { id: 'groups', label: 'Groups', href: '/groups' },
    { id: 'calendar', label: 'Calendar', href: '/calendar' },
  ];

  return (
    <header className="h-16 bg-neutral-white border-b border-neutral-gray-200 px-xl flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-lg">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-neutral-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5 text-neutral-gray-600" />
        </button>

        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-sm text-xl font-bold text-primary-600"
        >
          <span className="hidden sm:inline">Clauvin Memory</span>
          <span className="sm:hidden">CM</span>
        </Link>

        {/* Desktop Navigation */}
        {variant === 'default' && (
          <nav className="hidden lg:flex gap-lg items-center">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  activeSection === item.id
                    ? 'text-primary-600'
                    : 'text-neutral-gray-600 hover:text-neutral-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-md">
        {/* Notifications */}
        <button
          className="p-2 rounded-lg hover:bg-neutral-gray-100 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-neutral-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-semantic-error rounded-full" />
        </button>

        {/* User Menu */}
        {showUser && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-sm p-2 rounded-lg hover:bg-neutral-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-neutral-gray-900">
                  {userName}
                </p>
                <p className="text-xs text-neutral-gray-500">{userEmail}</p>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-neutral-white rounded-lg shadow-lg border border-neutral-gray-200 py-1 z-20">
                  <Link
                    href="/settings"
                    className="flex items-center gap-sm px-4 py-2 text-sm text-neutral-gray-700 hover:bg-neutral-gray-50"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <hr className="my-1 border-neutral-gray-200" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-sm w-full px-4 py-2 text-sm text-neutral-gray-700 hover:bg-neutral-gray-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};