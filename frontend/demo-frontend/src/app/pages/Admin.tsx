import { useEffect, useState, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router';
import { useWorkflow, UserRole, FormType } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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

const formTypes: FormType[] = ['ACP', 'Meal Request', 'RI', 'RFP', 'Item Request'];

export function Admin() {
  const { currentUser } = useWorkflow();
  const [users, setUsers] = useState<Array<any>>([]);
  const [accountRequests, setAccountRequests] = useState<Array<any>>([]);
  const [templates, setTemplates] = useState<Array<any>>([]);
  const [managedRoles, setManagedRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [roleName, setRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState('');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateType, setTemplateType] = useState<FormType | ''>('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string>('');
  const [templateApprovalSteps, setTemplateApprovalSteps] = useState<Array<{ id: string; role: string; department: string; userId: string; userName: string }>>([
    { id: 'step-0', role: '', department: '', userId: '', userName: '' },
  ]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
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
      const [usersRes, requestsRes, templatesRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
        fetch(`${API_BASE_URL}/api/admin/account-requests?status=pending`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
        fetch(`${API_BASE_URL}/api/templates`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
        fetch(`${API_BASE_URL}/api/roles`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        }),
      ]);

      if (!usersRes.ok || !requestsRes.ok || !templatesRes.ok || !rolesRes.ok) {
        const errorParts = [];
        if (!usersRes.ok) errorParts.push(`users(${usersRes.status})`);
        if (!requestsRes.ok) errorParts.push(`requests(${requestsRes.status})`);
        if (!templatesRes.ok) errorParts.push(`templates(${templatesRes.status})`);
        if (!rolesRes.ok) errorParts.push(`roles(${rolesRes.status})`);
        throw new Error(`Failed to load: ${errorParts.join(', ')}`);
      }

      const usersData = await usersRes.json();
      const requestsData = await requestsRes.json();
      const templatesData = await templatesRes.json();
      const rolesData = await rolesRes.json();
      setUsers(usersData);
      setAccountRequests(requestsData);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setManagedRoles(Array.isArray(rolesData) ? rolesData.map((role) => ({ id: role.id || role._id, name: role.name || role })) : []);
      // No template-specific department selection required for default approval chains.
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

  const approveRequest = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/account-requests/${requestId}/approve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
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

  const addTemplateStep = () => {
    setTemplateApprovalSteps((prev) => [
      ...prev,
      { id: `step-${Date.now()}`, role: '', department: '', userId: '', userName: '' },
    ]);
  };

  const updateTemplateStep = (index: number, key: 'role' | 'userId', value: string) => {
    setTemplateApprovalSteps((prev) =>
      prev.map((step, idx) => {
        if (idx !== index) return step;
        if (key === 'userId') {
          const user = users.find((item) => item._id === value);
          return {
            ...step,
            userId: value,
            userName: user ? user.username || user.name || user.email : '',
          };
        }
        return { ...step, [key]: value };
      })
    );
  };

  const removeTemplateStep = (index: number) => {
    setTemplateApprovalSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const createTemplate = async () => {
    if (!templateType || !templateTitle || !templateDescription) {
      setTemplateError('Template type, title, and description are required.');
      return;
    }

    if (!editingTemplateId && !templateFile) {
      setTemplateError('Template PDF is required when creating a new template.');
      return;
    }

    const invalidStep = templateApprovalSteps.some(
      (step) => !step.role.trim() || !step.userId.trim()
    );
    if (invalidStep) {
      setTemplateError('Every approval step must include a role and approver.');
      return;
    }

    setIsSavingTemplate(true);
    setTemplateError(null);

    try {
      const formData = new FormData();
      if (templateFile) {
        formData.append('pdfFile', templateFile);
      }
      formData.append('type', templateType);
      formData.append('title', templateTitle);
      formData.append('description', templateDescription);
      formData.append('approvalSteps', JSON.stringify(templateApprovalSteps));

      const url = editingTemplateId
        ? `${API_BASE_URL}/api/templates/${editingTemplateId}`
        : `${API_BASE_URL}/api/templates`;
      const method = editingTemplateId ? 'PUT' : 'POST';
      const headers: Record<string, string> = {};
      const authHeader = buildAuthHeaders().Authorization;
      if (authHeader) {
        headers.Authorization = authHeader;
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Failed to ${editingTemplateId ? 'update' : 'create'} template`);
      }

      const data = await response.json();
      setTemplates((prev) => {
        if (editingTemplateId) {
          return prev.map((template) => (template.id === data.id ? data : template));
        }
        return [data, ...prev];
      });
      setTemplateTitle('');
      setTemplateDescription('');
      setTemplateType('');
      setTemplateFile(null);
      setTemplateApprovalSteps([{ id: 'step-0', role: '', department: '', userId: '', userName: '' }]);
      setEditingTemplateId('');
      setTemplateError(null);
    } catch (err: any) {
      setTemplateError(err?.message || 'Unable to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    const confirmed = window.confirm('Delete this template? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/${templateId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) throw new Error('Failed to delete template');
      setTemplates((prev) => prev.filter((template) => template.id !== templateId));
    } catch (err) {
      setError('Could not delete template');
    }
  };

  const previewPdf = async (pdfUrl: string) => {
    setIsLoadingPdf(true);
    try {
      let inUrl: string | null = null;

      if (pdfUrl.startsWith('data:')) {
        const match = pdfUrl.match(/^data:(.+);base64,(.+)$/);
        if (!match) {
          throw new Error('Invalid data URL');
        }
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: match[1] });
        inUrl = URL.createObjectURL(blob);
      } else if (pdfUrl.startsWith('blob:')) {
        inUrl = pdfUrl;
      } else {
        const res = await fetch(pdfUrl);
        if (!res.ok) {
          throw new Error('Failed to fetch PDF');
        }
        let blob = await res.blob();
        if (blob.type !== 'application/pdf') {
          blob = new Blob([blob], { type: 'application/pdf' });
        }
        inUrl = URL.createObjectURL(blob);
      }

      if (!inUrl) {
        throw new Error('Unable to open PDF');
      }
      if (pdfViewerUrl && pdfViewerUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfViewerUrl);
      }
      setPdfViewerUrl(inUrl);
      setIsPdfViewerOpen(true);
    } catch (err) {
      console.error('Unable to preview PDF:', err);
      setError('Unable to preview PDF');
    } finally {
      setIsLoadingPdf(false);
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
            <CardTitle>Form Request Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="templateTitle">Template Title</Label>
                  <Input
                    id="templateTitle"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    placeholder="Title shown to users"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateType">Template Type</Label>
                  <Select value={templateType} onValueChange={(value) => setTemplateType(value as FormType)}>
                    <SelectTrigger id="templateType">
                      <SelectValue placeholder="Select template type" />
                    </SelectTrigger>
                    <SelectContent>
                      {formTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateDescription">Template Description</Label>
                <Textarea
                  id="templateDescription"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief summary of what this request is for"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateFile">Template PDF</Label>
                <input
                  type="file"
                  accept="application/pdf"
                  id="templateFile"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Default Approval Chain</Label>
                    <p className="text-sm text-gray-600">Assign the default approval chain for this template.</p>
                  </div>
                  <Button variant="secondary" size="sm" type="button" onClick={addTemplateStep}>
                    Add step
                  </Button>
                </div>

                <div className="space-y-3">
                  {templateApprovalSteps.map((step, index) => (
                    <div key={step.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={step.role} onValueChange={(value) => updateTemplateStep(index, 'role', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select approval role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Approver</Label>
                        <Select value={step.userId} onValueChange={(value) => updateTemplateStep(index, 'userId', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select approver" />
                          </SelectTrigger>
                          <SelectContent>
                            {users
                              .filter((user) => user.role !== 'Student')
                              .map((user) => (
                                <SelectItem key={user._id} value={user._id}>
                                  {user.username || user.email} — {user.role}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => removeTemplateStep(index)}
                        disabled={templateApprovalSteps.length <= 1}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {templateError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {templateError}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button onClick={createTemplate} disabled={isSavingTemplate}>
                  {isSavingTemplate ? (editingTemplateId ? 'Updating template...' : 'Saving template...') : (editingTemplateId ? 'Update Template' : 'Save Template')}
                </Button>
                {editingTemplateId && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingTemplateId('');
                      setTemplateTitle('');
                      setTemplateDescription('');
                      setTemplateType('');
                      setTemplateFile(null);
                      setTemplateApprovalSteps([{ id: 'step-0', role: '', department: '', userId: '', userName: '' }]);
                      setTemplateError(null);
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </div>

            {templates.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Title</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Type</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Created By</th>
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.id} className="hover:bg-gray-50">
                        <td className="p-3 border-b border-gray-200">{template.title}</td>
                        <td className="p-3 border-b border-gray-200">{template.type}</td>
                        <td className="p-3 border-b border-gray-200">{template.createdBy || '-'}</td>
                        <td className="p-3 border-b border-gray-200">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => previewPdf(template.pdfUrl)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                              disabled={isLoadingPdf}
                            >
                              {isLoadingPdf ? 'Loading...' : 'View PDF'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingTemplateId(template.id);
                                setTemplateTitle(template.title);
                                setTemplateDescription(template.description);
                                setTemplateType(template.type);
                                setTemplateFile(null);
                                setTemplateApprovalSteps(
                                  (template.approvalSteps || []).map((step: any) => ({
                                    id: step.id || `step-${Date.now()}`,
                                    role: step.role || '',
                                    userId: step.userId || '',
                                    userName: step.userName || '',
                                  }))
                                );
                              }}
                              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTemplate(template.id)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                            >
                              Delete
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

        <Dialog
          open={isPdfViewerOpen}
          onOpenChange={(open) => {
            setIsPdfViewerOpen(open);
            if (!open && pdfViewerUrl && pdfViewerUrl.startsWith('blob:')) {
              URL.revokeObjectURL(pdfViewerUrl);
              setPdfViewerUrl(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-4xl max-w-full h-[calc(100vh-5rem)] overflow-auto p-0">
            <div className="flex h-full flex-col bg-white">
              <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle>Preview PDF</DialogTitle>
                <DialogDescription>
                  Preview the selected template PDF inside the admin console.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto">
                {pdfViewerUrl ? (
                  <iframe
                    src={pdfViewerUrl}
                    title="PDF Preview"
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
                    No PDF selected for preview.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                      <th className="p-3 border-b border-gray-200 text-sm font-semibold">Actions</th>
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
                            {roleOptions.map((role) => (
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