import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, Navigate } from 'react-router';
import { io, Socket } from 'socket.io-client';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RefreshCcw } from 'lucide-react';

export function AdminPendingAccounts() {
  const { currentUser } = useWorkflow();
  const [requests, setRequests] = useState<Array<any>>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:4000';
  const AUTH_TOKEN_KEY = 'signnu_auth_token';

  const buildAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/account-requests?status=pending`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });

      if (!res.ok) {
        throw new Error(`Unable to load pending account requests (${res.status})`);
      }

      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load pending account requests.');
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Admin') {
      return;
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const socketConnection = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    socketConnection.on('connect', () => {
      console.debug('Admin pending accounts socket connected');
    });

    socketConnection.on('account-request:new', (request) => {
      setRequests((prevRequests) => {
        if (prevRequests.some((item) => item._id === request._id)) {
          return prevRequests;
        }
        return [request, ...prevRequests];
      });
    });

    socketConnection.on('account-request:status-changed', (payload) => {
      if (!payload?._id) return;
      setRequests((prevRequests) => prevRequests.filter((request) => request._id !== payload._id));
    });

    socketConnection.on('connect_error', (socketError) => {
      console.warn('Socket connection failed:', socketError);
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
      setSocket(null);
    };
  }, [API_BASE_URL, AUTH_TOKEN_KEY, currentUser]);

  const approveRequest = async (requestId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/account-requests/${requestId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!res.ok) {
        throw new Error('Failed to approve account request');
      }
      setRequests((prev) => prev.filter((request) => request._id !== requestId));
    } catch (err: any) {
      setError(err?.message || 'Could not approve account request');
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/account-requests/${requestId}/reject`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        body: JSON.stringify({ note: 'Rejected by admin' }),
      });
      if (!res.ok) {
        throw new Error('Failed to reject account request');
      }
      setRequests((prev) => prev.filter((request) => request._id !== requestId));
    } catch (err: any) {
      setError(err?.message || 'Could not reject account request');
    }
  };

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;

    return requests.filter((request) => {
      const name = (request.username || `${request.firstName || ''} ${request.lastName || ''}`).toLowerCase();
      const email = (request.email || '').toLowerCase();
      const department = (request.department || '').toLowerCase();
      const role = (request.role || '').toLowerCase();
      const organization = (request.organization || '').toLowerCase();
      return (
        name.includes(query) ||
        email.includes(query) ||
        department.includes(query) ||
        role.includes(query) ||
        organization.includes(query)
      );
    });
  }, [requests, search]);

  if (!currentUser || currentUser.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Pending Accounts</h1>
            <p className="text-gray-600 mt-2">Review and approve or reject pending account requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={fetchRequests} disabled={isLoading}>
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link to="/admin">
              <Button variant="ghost">Manage Accounts</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Account Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="pending-search">Search requests</Label>
              <Input
                id="pending-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, department, role, or organization"
              />
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            {isLoading ? (
              <p>Loading account requests...</p>
            ) : filteredRequests.length === 0 ? (
              <p className="text-sm text-gray-600">No pending account requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Name</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Email</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Department</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Organization</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Role</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr key={request._id} className="hover:bg-gray-50 bg-yellow-50/60">
                        <td className="p-3 border-b border-gray-200">{request.username || `${request.firstName} ${request.lastName}`}</td>
                        <td className="p-3 border-b border-gray-200">{request.email}</td>
                        <td className="p-3 border-b border-gray-200">{request.department || '-'}</td>
                        <td className="p-3 border-b border-gray-200">{request.organization || '-'}</td>
                        <td className="p-3 border-b border-gray-200">{request.role || '-'}</td>
                        <td className="p-3 border-b border-gray-200">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => approveRequest(request._id)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectRequest(request._id)}>
                              Reject
                            </Button>
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
      </div>
    </div>
  );
}
