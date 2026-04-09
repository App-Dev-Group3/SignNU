import { Navigate } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';

export function Admin() {
  const { currentUser } = useWorkflow();

  if (!currentUser || currentUser.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
        <p className="text-gray-600 mb-8">
          This is the administrative area. Only users with the <strong>Admin</strong> role can access this page.
        </p>

        <div className="grid grid-cols-1 gap-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-2">User management</h2>
            <p className="text-sm text-gray-500">
              Add admin-only controls here for managing users, roles, or system settings.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-2">System overview</h2>
            <p className="text-sm text-gray-500">
              Show analytics, notifications, or admin reports in this section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
