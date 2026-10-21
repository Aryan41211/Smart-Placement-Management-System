import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

/**
 * The authenticated application shell: sidebar, top bar and routed content.
 */
export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--app-bg)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[84rem] animate-fade-in-up">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-[var(--app-border)] bg-white px-6 py-4">
          <div className="mx-auto flex w-full max-w-[84rem] flex-wrap items-center justify-between gap-2 text-xs text-navy-400">
            <p>
              Smart Placement Management System &middot; Django&nbsp;5.2 &middot; DRF &middot; MySQL&nbsp;8.4
            </p>
            <p>React&nbsp;19 &middot; Vite &middot; Tailwind CSS</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
