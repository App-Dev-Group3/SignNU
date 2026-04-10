import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useWorkflow } from '../context/WorkflowContext';
import { Sidebar } from '../components/Sidebar';
import AIAssistant from '../components/ui/AIAssistant';

function ProtectedLayout() {
  const { isAuthenticated, authLoaded, currentUser } = useWorkflow();
  const location = useLocation();
  
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
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
        <AIAssistant /> {}
      </main>
    </div>
  );
}

export function Root() {
  return <ProtectedLayout />;
}