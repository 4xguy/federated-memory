import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export interface LayoutProps {
  children: React.ReactNode;
  activeSection?: string;
  userName?: string;
  userEmail?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeSection,
  userName,
  userEmail,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-gray-50">
      <Header
        activeSection={activeSection}
        onMenuClick={() => setSidebarOpen(true)}
        userName={userName}
        userEmail={userEmail}
      />
      
      <div className="flex">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        
        <main className="flex-1 p-lg lg:p-xl">
          {children}
        </main>
      </div>
    </div>
  );
};