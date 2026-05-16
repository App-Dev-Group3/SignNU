import { useEffect, useState, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router';
import { useWorkflow, UserRole } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
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
  const [managedRoles, setManagedRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [managedDepartments, setManagedDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [roleName, setRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [pendingRoleRequests, setPendingRoleRequests] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:4000';
  const AUTH_TOKEN_KEY = 'signnu_auth_token';

  const buildAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Memoized fetch function so it can be called on mount and on refresh
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes, departmentsRes, roleRequestsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
        fetch(`${API_BASE_URL}/api/roles`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
        fetch(`${API_BASE_URL}/api/departments`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
        fetch(`${API_BASE_URL}/api/admin/role-requests`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
      ]);

      if (!usersRes.ok || !rolesRes.ok || !departmentsRes.ok || !roleRequestsRes.ok) {
        const errorParts = [];
        if (!usersRes.ok) errorParts.push(`users(${usersRes.status})`);
        if (!rolesRes.ok) errorParts.push(`roles(${rolesRes.status})`);
        if (!departmentsRes.ok) errorParts.push(`departments(${departmentsRes.status})`);
        if (!roleRequestsRes.ok) errorParts.push(`roleRequests(${roleRequestsRes.status})`);
        throw new Error(`Failed to load: ${errorParts.join(', ')}`);
      }

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      const departmentsData = await departmentsRes.json();
      const roleRequestsData = await roleRequestsRes.json();
      setUsers(usersData);
      setManagedRoles(Array.isArray(rolesData) ? rolesData.map((role) => ({ id: role.id || role._id, name: role.name || role })) : []);
      setManagedDepartments(Array.isArray(departmentsData) ? departmentsData.map((dept) => ({ id: dept.id || dept._id, name: dept.name || dept })) : []);
      setPendingRoleRequests(Array.isArray(roleRequestsData) ? roleRequestsData : []);
      // No template-specific department selection required for default approval chains.
    } catch (err) {
      setError('Unable to load admin data.');
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
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        body: JSON.stringify({ department }),
      });
      if (!response.ok) throw new Error('Failed to update department');
      const updatedUser = await response.json();
      setUsers((prev) => prev.map((user) => user._id === updatedUser._id ? updatedUser : user));
    } catch (err) {
      setError('Could not update department');
    }
  };

  const updateUserData = async (userId: string, payload: Record<string, any>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update user');
      const updatedUser = await response.json();
      setUsers((prev) => prev.map((user) => user._id === updatedUser._id ? updatedUser : user));
    } catch (err) {
      setError('Could not update user');
    }
  };

  const saveRole = async () => {
    if (!roleName.trim()) {
      setRoleError('Role name is required.');
      return;
    }
    setIsSavingRole(true);
    setRoleError(null);

    try {
      const url = editingRoleId ? `${API_BASE_URL}/api/roles/${editingRoleId}` : `${API_BASE_URL}/api/roles`;
      const method = editingRoleId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        body: JSON.stringify({ name: roleName.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Failed to ${editingRoleId ? 'update' : 'create'} role`);
      }
      const savedRole = await response.json();
      setManagedRoles((prev) => {
        if (editingRoleId) {
          return prev.map((role) => (role.id === savedRole.id ? savedRole : role));
        }
        return [savedRole, ...prev];
      });
      setRoleName('');
      setEditingRoleId('');
    } catch (err: any) {
      setRoleError(err?.message || 'Unable to save role');
    } finally {
      setIsSavingRole(false);
    }
  };

  const saveDepartment = async () => {
    if (!departmentName.trim()) {
      setDepartmentError('Department name is required.');
      return;
    }
    setIsSavingDepartment(true);
    setDepartmentError(null);

    try {
      const url = editingDepartmentId ? `${API_BASE_URL}/api/departments/${editingDepartmentId}` : `${API_BASE_URL}/api/departments`;
      const method = editingDepartmentId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        body: JSON.stringify({ name: departmentName.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Failed to ${editingDepartmentId ? 'update' : 'create'} department`);
      }
      const savedDepartment = await response.json();
      setManagedDepartments((prev) => {
        if (editingDepartmentId) {
          return prev.map((dept) => (dept.id === savedDepartment.id ? savedDepartment : dept));
        }
        return [savedDepartment, ...prev];
      });
      setDepartmentName('');
      setEditingDepartmentId('');
    } catch (err: any) {
      setDepartmentError(err?.message || 'Unable to save department');
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const editDepartment = (departmentId: string) => {
    const department = managedDepartments.find((item) => item.id === departmentId);
    if (!department) return;
    setEditingDepartmentId(department.id);
    setDepartmentName(department.name);
  };

  const deleteDepartment = async (departmentId: string) => {
    const confirmed = window.confirm('Delete this department? This will remove it from the managed list.');
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/departments/${departmentId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) throw new Error('Failed to delete department');
      setManagedDepartments((prev) => prev.filter((dept) => dept.id !== departmentId));
    } catch (err) {
      setError('Could not delete department');
    }
  };

  const editRole = (roleId: string) => {
    const role = managedRoles.find((item) => item.id === roleId);
    if (!role) return;
    setEditingRoleId(role.id);
    setRoleName(role.name);
  };

  const deleteRole = async (roleId: string) => {
    const confirmed = window.confirm('Delete this role? This will remove it from the managed list.');
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) throw new Error('Failed to delete role');
      setManagedRoles((prev) => prev.filter((role) => role.id !== roleId));
    } catch (err) {
      setError('Could not delete role');
    }
  };

  const roleOptions = managedRoles.length > 0 ? managedRoles.map((r) => r.name) : roles;
  const departmentOptions = managedDepartments.length > 0 ? managedDepartments.map((d) => d.name) : ['SCS', 'SABM', 'SAS', 'SEA'];

  const approveExistingUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/${userId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) throw new Error('Failed to delete user');
      setUsers((prev) => prev.filter((user) => user._id !== userId));
    } catch (err) {
      setError('Could not delete user account');
    }
  };

  const approvePendingRoleRequest = async (userId: string, requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/role-requests/${userId}/${requestId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) throw new Error('Failed to approve role request');
      const data = await response.json();
      setPendingRoleRequests((prev) => prev.filter((req) => req.requestId !== requestId));
      setUsers((prev) => prev.map((user) => user._id === data.user._id ? data.user : user));
    } catch (err) {
      setError('Could not approve role request');
    }
  };

  const rejectPendingRoleRequest = async (userId: string, requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/role-requests/${userId}/${requestId}/reject`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) throw new Error('Failed to reject role request');
      setPendingRoleRequests((prev) => prev.filter((req) => req.requestId !== requestId));
    } catch (err) {
      setError('Could not reject role request');
    }
  };

  const filteredUsers = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const name = (user.username || `${user.firstName || ''} ${user.lastName || ''}`).toLowerCase();
      const email = (user.email || '').toLowerCase();
      const department = (user.department || '').toLowerCase();
      const role = (user.role || '').toLowerCase();
      const organization = (user.organization || '').toLowerCase();
      const userType = (user.userType || '').toLowerCase();
      const councilRole = (user.councilRole || '').toLowerCase();
      const employeeRole = (user.employeeRole || '').toLowerCase();

      return (
        name.includes(query) ||
        email.includes(query) ||
        department.includes(query) ||
        role.includes(query) ||
        organization.includes(query) ||
        userType.includes(query) ||
        councilRole.includes(query) ||
        employeeRole.includes(query)
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Managed Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 items-end">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="roleName">Role Name</Label>
                  <Input
                    id="roleName"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g. Department Head"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveRole} disabled={isSavingRole}>
                    {isSavingRole ? (editingRoleId ? 'Updating...' : 'Saving...') : (editingRoleId ? 'Update Role' : 'Add Role')}
                  </Button>
                  {editingRoleId && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingRoleId('');
                        setRoleName('');
                        setRoleError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {roleError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {roleError}
                </div>
              )}

              {managedRoles.length === 0 ? (
                <p className="text-sm text-gray-600">No managed roles created yet.</p>
              ) : (
                <div className="space-y-2">
                  {managedRoles.map((role) => (
                    <div key={role.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                      <span className="text-sm text-gray-900">{role.name}</span>
                      <div className="flex gap-2">
                        <Button size="sm" type="button" onClick={() => editRole(role.id)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" type="button" onClick={() => deleteRole(role.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Managed Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 items-end">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="departmentName">Department Name</Label>
                  <Input
                    id="departmentName"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="e.g. SCS"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveDepartment} disabled={isSavingDepartment}>
                    {isSavingDepartment ? (editingDepartmentId ? 'Updating...' : 'Saving...') : (editingDepartmentId ? 'Update Department' : 'Add Department')}
                  </Button>
                  {editingDepartmentId && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingDepartmentId('');
                        setDepartmentName('');
                        setDepartmentError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {departmentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {departmentError}
                </div>
              )}

              {managedDepartments.length === 0 ? (
                <p className="text-sm text-gray-600">No managed departments created yet.</p>
              ) : (
                <div className="space-y-2">
                  {managedDepartments.map((department) => (
                    <div key={department.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                      <span className="text-sm text-gray-900">{department.name}</span>
                      <div className="flex gap-2">
                        <Button size="sm" type="button" onClick={() => editDepartment(department.id)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" type="button" onClick={() => deleteDepartment(department.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pending Role Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRoleRequests.length === 0 ? (
              <p className="text-sm text-gray-600">No pending additional role requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingRoleRequests.map((request) => (
                  <div key={`${request.userId}-${request.requestId}`} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                    <div className="mt-3 text-sm text-gray-500">
                      Current roles: {(request.roles || []).join(', ') || '-'}
                    </div>
                  </div>
                ))}
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
                placeholder="Search accounts by name, email, department, organization, or role..."
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
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Organization</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">User Type</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Student Council</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Council Role</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Employee Role</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Roles</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Status</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user._id} className={`hover:bg-gray-50 ${!user.isApproved ? 'bg-yellow-50' : ''}`}>
                        <td className="p-3 border-b border-gray-200">{user.username || user.email}</td>
                        <td className="p-3 border-b border-gray-200">{user.email}</td>
                        <td className="p-3 border-b border-gray-200">
                          <select
                            value={user.department || ''}
                            onChange={(e) => updateDepartment(user._id, e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                          >
                            <option value="" disabled>{managedDepartments.length > 0 ? 'Select department' : 'Select department'}</option>
                            {departmentOptions.map((department) => (
                              <option key={department} value={department}>{department}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          {user.organization || '-'}
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          <select
                            value={user.userType || 'Employee'}
                            onChange={(e) => updateUserData(user._id, { userType: e.target.value, ...(e.target.value === 'Employee' ? { isCouncilMember: false, councilRole: '' } : {}) })}
                            className="border rounded-lg px-3 py-2"
                          >
                            <option value="Employee">Employee</option>
                            <option value="Student">Student</option>
                          </select>
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          {user.userType === 'Student' ? (
                            <select
                              value={user.isCouncilMember ? 'yes' : 'no'}
                              onChange={(e) => updateUserData(user._id, { isCouncilMember: e.target.value === 'yes', ...(e.target.value === 'no' ? { councilRole: '' } : {}) })}
                              className="border rounded-lg px-3 py-2"
                            >
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          {user.userType === 'Student' && user.isCouncilMember ? (
                            <select
                              value={user.councilRole || ''}
                              onChange={(e) => updateUserData(user._id, { councilRole: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2"
                            >
                              <option value="" disabled>Select council role</option>
                              {['President', 'Vice President', 'Secretary', 'Treasurer'].map((councilRole) => (
                                <option key={councilRole} value={councilRole}>{councilRole}</option>
                              ))}
                            </select>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          {user.userType === 'Employee' ? (
                            <input
                              type="text"
                              defaultValue={user.employeeRole || ''}
                              onBlur={(e) => updateUserData(user._id, { employeeRole: e.target.value.trim() })}
                              placeholder="Employee role"
                              className="w-full border rounded-lg px-3 py-2"
                            />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 border-b border-gray-200">
                          <div className="space-y-2">
                            <div className="text-sm text-gray-700">
                              {(user.roles && user.roles.length > 0) ? user.roles.join(', ') : user.role || '-'}
                            </div>
                            <select
                              value={user.role}
                              onChange={(e) => updateRole(user._id, e.target.value as UserRole)}
                              className="border rounded-lg px-3 py-2"
                              disabled={user._id === currentUser.id}
                            >
                              {roleOptions.map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                          </div>
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