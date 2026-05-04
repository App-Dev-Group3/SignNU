import { useEffect, useState, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router';
import { useWorkflow, UserRole } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { RefreshCcw } from 'lucide-react'; // Import the icon

const roles: UserRole[] = [
  'Department Head',
  'Dean',
  'Faculty',
  'Staff',
  'Student',
  'Finance Officer',
  'Procurement Officer',
  'VP for Academics',
  'VP for Finance',
  'Requester',
  'Signatory',
  'Reviewer',
  'Admin',
];

export function Admin() {
  const { currentUser } = useWorkflow();
  const [users, setUsers] = useState<Array<any>>([]);
  const [accountRequests, setAccountRequests] = useState<Array<any>>([]);
  const [pendingSearch, setPendingSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const viteEnv = import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } };
  const API_BASE_URL = viteEnv.env?.VITE_API_BASE_URL || 'http://localhost:4000';

  // Memoized fetch function so it can be called on mount and on refresh
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, requestsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`${API_BASE_URL}/api/admin/account-requests?status=pending`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }),
      ]);

      if (!usersRes.ok || !requestsRes.ok) {
        throw new Error('Failed to load users or account requests');
      }

      const usersData = await usersRes.json();
      const requestsData = await requestsRes.json();
      setUsers(usersData);
      setAccountRequests(requestsData);
    } catch (err) {
      setError('Unable to load users or account requests.');
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateRole = async (userId: string, role: UserRole) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed to update role');
      const updatedUser = await response.json();
      setUsers((prev) => prev.map((user) => user._id === updatedUser._id ? updatedUser : user));
    } catch (err) {
      setError('Could not update role');
    }
  };

  const updateDepartment = async (userId: string, department: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department }),
      });
      if (!response.ok) throw new Error('Failed to update department');
      const updatedUser = await response.json();
      setUsers((prev) => prev.map((user) => user._id === updatedUser._id ? updatedUser : user));
    } catch (err) {
      setError('Could not update department');
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/account-requests/${requestId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to approve account request');
      const data = await response.json();
      if (data.user) {
        setUsers((prev) => [data.user, ...prev]);
      }
      setAccountRequests((prev) => prev.filter((request) => request._id !== requestId));
    } catch (err) {
      setError('Could not approve account request');
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/account-requests/${requestId}/reject`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Rejected by admin' }),
      });
      if (!response.ok) throw new Error('Failed to reject account request');
      setAccountRequests((prev) => prev.filter((request) => request._id !== requestId));
    } catch (err) {
      setError('Could not reject account request');
    }
  };

  const approveExistingUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/${userId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to approve user');
      setUsers((prev) => prev.map((user) => user._id === userId ? { ...user, isApproved: true } : user));
    } catch (err) {
      setError('Could not approve user');
    }
  };

  const deleteUser = async (userId: string) => {
    const confirmed = window.confirm('Delete this account? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to delete user');
      setUsers((prev) => prev.filter((user) => user._id !== userId));
    } catch (err) {
      setError('Could not delete user account');
    }
  };

  const filteredAccountRequests = useMemo(() => {
    const query = pendingSearch.trim().toLowerCase();
    if (!query) return accountRequests;

    return accountRequests.filter((request) => {
      const name = (request.username || `${request.firstName || ''} ${request.lastName || ''}`).toLowerCase();
      const email = (request.email || '').toLowerCase();
      const department = (request.department || '').toLowerCase();
      const role = (request.role || '').toLowerCase();

      return (
        name.includes(query) ||
        email.includes(query) ||
        department.includes(query) ||
        role.includes(query)
      );
    });
  }, [accountRequests, pendingSearch]);

  const filteredUsers = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const name = (user.username || `${user.firstName || ''} ${user.lastName || ''}`).toLowerCase();
      const email = (user.email || '').toLowerCase();
      const department = (user.department || '').toLowerCase();
      const role = (user.role || '').toLowerCase();

      return (
        name.includes(query) ||
        email.includes(query) ||
        department.includes(query) ||
        role.includes(query)
      );
    });
  }, [users, accountSearch]);

  if (!currentUser || currentUser.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Admin</h1>
            <p className="text-gray-600 mt-2">Manage user accounts and roles.</p>
          </div>
          
          {/* REFRESH BUTTON */}
          <Button 
            variant="outline" 
            onClick={fetchData} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Account Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <input
                type="search"
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                placeholder="Search pending requests by name, email, department, or role..."
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            {isLoading && accountRequests.length === 0 ? (
              <p>Loading account requests...</p>
            ) : filteredAccountRequests.length === 0 ? (
              <p className="text-sm text-gray-600">No pending account requests.</p>
            ) : (
              <div className="overflow-x-auto mb-8">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Name</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Email</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Department</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Role</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccountRequests.map((request) => (
                      <tr key={request._id} className="hover:bg-yellow-50 bg-yellow-50/60">
                        <td className="p-3 border-b border-gray-200">{request.username || `${request.firstName} ${request.lastName}`}</td>
                        <td className="p-3 border-b border-gray-200">{request.email}</td>
                        <td className="p-3 border-b border-gray-200">{request.department || '-'}</td>
                        <td className="p-3 border-b border-gray-200">{request.role || '-'}</td>
                        <td className="p-3 border-b border-gray-200">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => approveRequest(request._id)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectRequest(request._id)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <input
                type="search"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Search accounts by name, email, department, or role..."
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            {isLoading && users.length === 0 ? (
              <p>Loading accounts...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Name</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Email</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Department</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Role</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Status</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user._id} className={`hover:bg-gray-50 ${!user.isApproved ? 'bg-yellow-50' : ''}`}>
                        <td className="p-3 border-b border-gray-200">{user.username || user.email}</td>
                        <td className="p-3 border-b border-gray-200">{user.email}</td>
                        <td className="p-3 border-b border-gray-200">
                          <input
                            type="text"
                            defaultValue={user.department || ''}
                            onBlur={(e) => updateDepartment(user._id, e.target.value.trim())}
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="Department"
                          />
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          <select
                            value={user.role}
                            onChange={(e) => updateRole(user._id, e.target.value as UserRole)}
                            className="border rounded-lg px-3 py-2"
                            disabled={user._id === currentUser.id}
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          {!user.isApproved ? (
                            <button
                              onClick={() => approveExistingUser(user._id)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                            >
                              Approve
                            </button>
                          ) : (
                            <span className="text-sm text-green-600 font-semibold">Approved</span>
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          <button
                            onClick={() => deleteUser(user._id)}
                            className="px-3 py-1 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900"
                          >
                            Delete
                          </button>
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