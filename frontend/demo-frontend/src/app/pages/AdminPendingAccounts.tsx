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
  const [pendingRoleRequests, setPendingRoleRequests] = useState<Array<any>>([]);
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
      const [accountsRes, roleRequestsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/account-requests?status=pending`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
        fetch(`${API_BASE_URL}/api/admin/role-requests?status=pending`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
      ]);

      if (!accountsRes.ok || !roleRequestsRes.ok) {
        const errorParts = [];
        if (!accountsRes.ok) errorParts.push(`accounts(${accountsRes.status})`);
        if (!roleRequestsRes.ok) errorParts.push(`roleRequests(${roleRequestsRes.status})`);
        throw new Error(`Unable to load pending requests: ${errorParts.join(', ')}`);
      }

      const [accountsData, roleRequestsData] = await Promise.all([accountsRes.json(), roleRequestsRes.json()]);
      setRequests(Array.isArray(accountsData) ? accountsData : []);
      setPendingRoleRequests(Array.isArray(roleRequestsData) ? roleRequestsData : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load pending requests.');
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

  const approvePendingRoleRequest = async (userId: string, requestId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/role-requests/${userId}/${requestId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!res.ok) {
        throw new Error('Failed to approve role request');
      }
      setPendingRoleRequests((prev) => prev.filter((request) => request.requestId !== requestId));
    } catch (err: any) {
      setError(err?.message || 'Could not approve role request');
    }
  };

  const rejectPendingRoleRequest = async (userId: string, requestId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/role-requests/${userId}/${requestId}/reject`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!res.ok) {
        throw new Error('Failed to reject role request');
      }
      setPendingRoleRequests((prev) => prev.filter((request) => request.requestId !== requestId));
    } catch (err: any) {
      setError(err?.message || 'Could not reject role request');
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

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div>
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

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Role Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingRoleRequests.length === 0 ? (
                  <p className="text-sm text-gray-600">No pending role requests.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingRoleRequests.map((request) => (
                      <div key={`${request.userId}-${request.requestId}`} className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex flex-col gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{request.role}</p>
                            <p className="text-sm text-gray-600">Requested by {request.username || request.email}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => approvePendingRoleRequest(request.userId, request.requestId)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => rejectPendingRoleRequest(request.userId, request.requestId)}>
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
