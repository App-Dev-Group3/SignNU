import { Outlet, Navigate, useLocation } from 'react-router';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { Sidebar } from '../components/Sidebar';
import AIAssistant from '../components/ui/AIAssistant';
import { Button } from '../components/ui/button';

function ProtectedLayout() {
  const { isAuthenticated, authLoaded, currentUser } = useWorkflow();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  if (!authLoaded) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/' && currentUser?.role === 'Admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-auto md:ml-0">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm font-semibold text-gray-900">SignNU</p>
            <p className="text-xs text-gray-500">Navigation</p>
          </div>
        </div>
        <Outlet />
        <AIAssistant /> {}
      </main>
    </div>
  );
}

export function Root() {
  return <ProtectedLayout />;
}