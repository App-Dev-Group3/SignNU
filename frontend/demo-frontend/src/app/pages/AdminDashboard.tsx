import { Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export function AdminDashboard() {
  const { currentUser, forms } = useWorkflow();

  if (!currentUser || currentUser.role !== 'Admin') {
    return null;
  }

  const pendingRequests = forms.filter((form) => form.status === 'pending');

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">View all pending requests in the system.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>Pending Requests</CardTitle>
                <CardDescription>Read-only list of requests awaiting approval.</CardDescription>
              </div>
              <Badge variant="secondary">No edit access</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Total pending requests</p>
                <p className="text-3xl font-semibold text-gray-900">{pendingRequests.length}</p>
              </div>
              <Link to="/admin">
                <Button variant="secondary">View Accounts</Button>
              </Link>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <p className="text-lg font-medium">No pending requests found.</p>
                <p className="text-sm">Admins can review these requests but cannot modify them from this screen.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Title</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Type</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Requester</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Submitted</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Status</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((form) => (
                      <tr key={form.id} className="hover:bg-gray-50">
                        <td className="p-3 border-b border-gray-200">{form.title}</td>
                        <td className="p-3 border-b border-gray-200">{form.type}</td>
                        <td className="p-3 border-b border-gray-200">{form.submittedBy}</td>
                        <td className="p-3 border-b border-gray-200">{new Date(form.submittedAt).toLocaleDateString()}</td>
                        <td className="p-3 border-b border-gray-200">
                          <Badge variant="secondary">{form.status}</Badge>
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          <Link to={`/form/${form.id}`}>
                            <Button size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
