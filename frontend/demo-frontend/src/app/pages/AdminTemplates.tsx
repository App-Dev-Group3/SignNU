import { useEffect, useState, useMemo, useCallback } from 'react';
import { Navigate, Link } from 'react-router';
import { useWorkflow, FormType } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RefreshCcw } from 'lucide-react';

const roles = [
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

export function AdminTemplates() {
  const { currentUser } = useWorkflow();
  const [users, setUsers] = useState<Array<any>>([]);
  const [templates, setTemplates] = useState<Array<any>>([]);
  const [managedRoles, setManagedRoles] = useState<Array<{ id: string; name: string }>>([]);
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:4000';
  const AUTH_TOKEN_KEY = 'signnu_auth_token';

  const buildAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [usersRes, templatesRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users`, {
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

      if (!usersRes.ok || !templatesRes.ok || !rolesRes.ok) {
        const errorParts = [];
        if (!usersRes.ok) errorParts.push(`users(${usersRes.status})`);
        if (!templatesRes.ok) errorParts.push(`templates(${templatesRes.status})`);
        if (!rolesRes.ok) errorParts.push(`roles(${rolesRes.status})`);
        throw new Error(`Failed to load: ${errorParts.join(', ')}`);
      }

      const usersData = await usersRes.json();
      const templatesData = await templatesRes.json();
      const rolesData = await rolesRes.json();
      setUsers(usersData);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setManagedRoles(Array.isArray(rolesData) ? rolesData.map((role) => ({ id: role.id || role._id, name: role.name || role })) : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load templates.');
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

    const invalidStep = templateApprovalSteps.some((step) => !step.role.trim() || !step.userId.trim());
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
      if (authHeader) headers.Authorization = authHeader;

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
    } catch (err: any) {
      setError(err?.message || 'Could not delete template');
    }
  };

  const previewPdf = async (pdfUrl: string) => {
    setIsLoadingPdf(true);
    try {
      let inUrl: string | null = null;

      if (pdfUrl.startsWith('data:')) {
        const match = pdfUrl.match(/^data:(.+);base64,(.+)$/);
        if (!match) throw new Error('Invalid data URL');
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: match[1] });
        inUrl = URL.createObjectURL(blob);
      } else if (pdfUrl.startsWith('blob:')) {
        inUrl = pdfUrl;
      } else {
        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error('Failed to fetch PDF');
        let blob = await res.blob();
        if (blob.type !== 'application/pdf') blob = new Blob([blob], { type: 'application/pdf' });
        inUrl = URL.createObjectURL(blob);
      }

      if (!inUrl) throw new Error('Unable to open PDF');

      if (pdfViewerUrl && pdfViewerUrl.startsWith('blob:')) URL.revokeObjectURL(pdfViewerUrl);
      setPdfViewerUrl(inUrl);
      setIsPdfViewerOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to preview PDF');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const roleOptions = managedRoles.length > 0 ? managedRoles.map((role) => role.name) : roles;

  const editTemplate = (template: any) => {
    setEditingTemplateId(template.id);
    setTemplateTitle(template.title);
    setTemplateDescription(template.description);
    setTemplateType(template.type);
    setTemplateApprovalSteps(
      (template.approvalSteps || []).map((step: any) => ({
        id: step.id || `step-${Date.now()}`,
        role: step.role || '',
        department: step.department || '',
        userId: step.userId || '',
        userName: step.userName || '',
      }))
    );
  };

  if (!currentUser || currentUser.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Form Request Templates</h1>
            <p className="text-gray-600 mt-2">Create, edit, and manage admin-approved form templates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={fetchData} disabled={isLoading}>
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link to="/admin">
              <Button variant="ghost">Back to Accounts</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create or Update Template</CardTitle>
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
                <Input
                  id="templateDescription"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief summary of what this request is for"
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
                              <SelectItem key={role} value={role}>{role}</SelectItem>
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
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Existing Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-gray-600">No templates available yet.</p>
            ) : (
              <div className="overflow-x-auto">
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
                            <Button size="sm" type="button" onClick={() => previewPdf(template.pdfUrl)}>
                              View PDF
                            </Button>
                            <Button size="sm" variant="secondary" type="button" onClick={() => editTemplate(template)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" type="button" onClick={() => deleteTemplate(template.id)}>
                              Delete
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
