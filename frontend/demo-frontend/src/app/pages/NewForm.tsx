import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useWorkflow, FormType, FormStatus } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Upload, X } from 'lucide-react';
import { PdfEditor, PdfAnnotation } from '../components/PdfEditor';

const formTypes: FormType[] = ['ACP', 'Meal Request', 'RI', 'RFP', 'Item Request'];

const approvalChains: Record<FormType, Array<{ role: string; userId: string; userName: string }>> = {
  'ACP': [
    { role: 'Department Head', userId: 'user-1', userName: 'Juan Dela Cruz' },
    { role: 'Dean', userId: 'user-3', userName: 'Robert Garcia' },
    { role: 'VP for Academics', userId: 'user-4', userName: 'Anna Reyes' },
  ],
  'Meal Request': [
    { role: 'Department Head', userId: 'user-1', userName: 'Juan Dela Cruz' },
    { role: 'Finance Officer', userId: 'user-6', userName: 'Lisa Chen' },
  ],
  'RI': [
    { role: 'Department Head', userId: 'user-1', userName: 'Juan Dela Cruz' },
    { role: 'Finance Officer', userId: 'user-6', userName: 'Lisa Chen' },
    { role: 'VP for Finance', userId: 'user-8', userName: 'Sarah Johnson' },
  ],
  'RFP': [
    { role: 'Department Head', userId: 'user-1', userName: 'Juan Dela Cruz' },
    { role: 'Procurement Officer', userId: 'user-7', userName: 'Thomas Wilson' },
    { role: 'VP for Finance', userId: 'user-8', userName: 'Sarah Johnson' },
  ],
  'Item Request': [
    { role: 'Dean', userId: 'user-3', userName: 'Robert Garcia' },
    { role: 'Procurement Officer', userId: 'user-7', userName: 'Thomas Wilson' },
    { role: 'VP for Finance', userId: 'user-8', userName: 'Sarah Johnson' },
  ],
};

export function NewForm() {
  const navigate = useNavigate();
  const { addForm, updateForm, deleteForm, generateFormPdf, currentUser } = useWorkflow();
  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const AUTH_TOKEN_KEY = 'signnu_auth_token';

  const buildAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  if (!currentUser) {
    return null;
  }

  const formIdRef = useRef(`form-${Date.now()}`);
  const [formType, setFormType] = useState<FormType | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<Array<{ id?: string; name: string; size: number; type: string; url?: string }>>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; role: string; department?: string }>>([]);
  const [approvalRoleOptions, setApprovalRoleOptions] = useState<string[]>([]);
  const [approvalDepartmentOptions, setApprovalDepartmentOptions] = useState<string[]>([]);
  const [approvalSteps, setApprovalSteps] = useState<Array<{ id?: string; role: string; department: string; userId: string; userName: string }>>([]);
  const [templateApprovalSteps, setTemplateApprovalSteps] = useState<Array<{ id?: string; role: string; department: string; userId: string; userName: string }>>([]);
  const [formTemplates, setFormTemplates] = useState<Array<any>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [pdfSourceFile, setPdfSourceFile] = useState<File | null>(null);
  const [pdfAnnotations, setPdfAnnotations] = useState<PdfAnnotation[]>([]);
  const [showPdfEditor, setShowPdfEditor] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('');
  const [draftCreated, setDraftCreated] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [isLoadingPdfPreview, setIsLoadingPdfPreview] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);

  const isValidUrl = (value: string | undefined | null) => {
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.href);
      return ['http:', 'https:', 'blob:', 'data:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/approvers`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...buildAuthHeaders(),
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load approvers: ${response.status} ${errorText}`);
        }
        const fetchedUsers = await response.json();
        const processedUsers = fetchedUsers
          .map((user: any) => ({
            id: user._id || user.id,
            name: user.username || user.name || user.email,
            role: user.role,
            department: user.department,
          }))
          .filter((user: { role: string }) => user.role !== 'Student');
        
        setAvailableUsers(processedUsers);

        // Extract unique roles and departments from available users
        const uniqueRoles = Array.from(
          new Set(
            processedUsers
              .map((u: any) => u.role)
              .filter((r: string) => r && r.trim())
          )
        ).sort() as string[];

        const uniqueDepartments = Array.from(
          new Set(
            processedUsers
              .map((u: any) => u.department)
              .filter((d: string) => d && d.trim())
          )
        ).sort() as string[];

        setApprovalRoleOptions(uniqueRoles);
        setApprovalDepartmentOptions(uniqueDepartments);
        setUserLoadError(null);
      } catch (error: any) {
        console.error('Error loading approvers:', error);
        setUserLoadError(error.message || 'Failed to load approvers');
      }
    };

    fetchUsers();
  }, [API_BASE_URL]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/templates`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        });
        if (!response.ok) {
          throw new Error('Failed to load templates');
        }
        const data = await response.json();
        setFormTemplates(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    };

    fetchTemplates();
  }, [API_BASE_URL]);

  const applySelectedTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);

    if (!templateId) {
      setAttachments([]);
      setGeneratedPdfUrl('');
      setTemplateApprovalSteps([]);
      setApprovalSteps([]);
      setFormType('');
      return;
    }

    const template = formTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    const mappedTemplateSteps = (template.approvalSteps || []).map((step: any, index: number) => ({
      id: step.id || `template-step-${Date.now()}-${index}`,
      role: step.role || '',
      department: step.department || '',
      userId: step.userId || '',
      userName: step.userName || '',
    }));

    setFormType(template.type);
    setTitle(template.title);
    setDescription(template.description);
    setTemplateApprovalSteps(mappedTemplateSteps);
    setApprovalSteps(mappedTemplateSteps);
    setAttachments([
      {
        id: `template-${template.id}`,
        name: template.title,
        size: 0,
        type: 'application/pdf',
        url: template.pdfUrl,
      },
    ]);
    setGeneratedPdfUrl(template.pdfUrl);
    setPdfSourceFile(null);
    setPdfAnnotations([]);
  };

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }

    const template = formTemplates.find((item) => item.id === selectedTemplateId);
    if (!template) {
      return;
    }

    const mappedTemplateSteps = (template.approvalSteps || []).map((step: any, index: number) => ({
      id: step.id || `template-step-${Date.now()}-${index}`,
      role: step.role || '',
      department: step.department || '',
      userId: step.userId || '',
      userName: step.userName || '',
    }));

    setTemplateApprovalSteps(mappedTemplateSteps);
  }, [selectedTemplateId, formTemplates]);

  useEffect(() => {
    return () => {
      if (pdfViewerUrl && pdfViewerUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfViewerUrl);
      }
    };
  }, [pdfViewerUrl]);

  const previewPdf = async (pdfUrl: string) => {
    setIsLoadingPdfPreview(true);
    setPdfPreviewError(null);

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
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to fetch PDF for preview');
        let blob = await response.blob();
        if (blob.type !== 'application/pdf') {
          blob = new Blob([blob], { type: 'application/pdf' });
        }
        inUrl = URL.createObjectURL(blob);
      }

      if (!inUrl) throw new Error('Unable to create preview URL');
      if (pdfViewerUrl && pdfViewerUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfViewerUrl);
      }
      setPdfViewerUrl(inUrl);
      setIsPdfViewerOpen(true);
    } catch (error: any) {
      console.error('Preview PDF failed:', error);
      setPdfPreviewError(error?.message || 'Unable to preview PDF');
    } finally {
      setIsLoadingPdfPreview(false);
    }
  };

  const handleSavePdf = async () => {
    if (!pdfSourceFile) {
      toast.error('Please upload a PDF file first');
      return;
    }

    if (!draftCreated) {
      const formId = formIdRef.current;
      const requesterSignatureEntry = currentUser.signatureURL
        ? [
            {
              id: `sig-${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.name,
              role: currentUser.role,
              signedAt: new Date().toISOString(),
              signature: currentUser.signatureURL,
            },
          ]
        : [];

      const draftForm = await addForm({
        id: formId,
        type: formType || 'ACP',
        title,
        description,
        submittedBy: currentUser.name,
        submittedById: currentUser.id,
        formData,
        attachments: [],
        approvalSteps: approvalSteps.map((step, index) => ({
          id: `step-${Date.now()}-${index}`,
          ...step,
          status: 'pending' as const,
        })),
        signatures: requesterSignatureEntry,
        status: 'draft' as FormStatus,
      });

      if (!draftForm) {
        toast.error('Unable to create draft form');
        return;
      }
      setDraftCreated(true);
    }

    const textFields = {};

    setIsGeneratingPdf(true);
    try {
      const pdfUrl = await generateFormPdf(
        formIdRef.current,
        pdfSourceFile,
        textFields,
        currentUser.signatureURL ?? null,
        null,
        pdfAnnotations
      );
      if (!pdfUrl || !isValidUrl(pdfUrl)) {
        throw new Error('Received invalid PDF URL from server');
      }
      setGeneratedPdfUrl(pdfUrl);
      setAttachments((prev) => [
        ...prev,
        { name: pdfSourceFile.name, size: pdfSourceFile.size, type: pdfSourceFile.type, url: pdfUrl },
      ]);
      toast.success('PDF saved successfully');
    } catch (error: any) {
      console.error('PDF save failed:', error);
      toast.error(error?.message || 'Failed to save PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!draftCreated) return;

    const confirmed = window.confirm(
      'Delete this draft? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await deleteForm(formIdRef.current);
      setDraftCreated(false);
      setGeneratedPdfUrl('');
      setPdfSourceFile(null);
      setPdfAnnotations([]);
      setAttachments([]);
      setFormType('');
      setTitle('');
      setDescription('');
      setFormData({});
      setApprovalSteps([]);
      toast.success('Draft deleted successfully');
      navigate('/submissions');
    } catch (error) {
      console.error('Delete draft failed:', error);
      toast.error('Unable to delete draft');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formType || !title || !description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formTemplates.length > 0 && !selectedTemplateId) {
      toast.error('Please select an admin-created form template');
      return;
    }

    if (!selectedTemplateId && !pdfSourceFile && attachments.length === 0) {
      toast.error('Please upload a PDF document before submitting your request');
      return;
    }

    if (approvalSteps.length === 0 || approvalSteps.some((step) => !step.role.trim() || !step.department.trim() || !step.userId)) {
      toast.error('Please enter a role, department, and select an approver for every approval step');
      return;
    }

    const formId = formIdRef.current;
    const requesterSignatureEntry = currentUser.signatureURL
      ? [
          {
            id: `sig-${Date.now()}`,
            userId: currentUser.id,
            userName: currentUser.name,
            role: currentUser.role,
            signedAt: new Date().toISOString(),
            signature: currentUser.signatureURL,
          },
        ]
      : [];

    const baseForm = {
      id: formId,
      type: formType,
      title,
      description,
      submittedBy: currentUser.name,
      submittedById: currentUser.id,
      formData,
      attachments: attachments.map((att, index) => ({
        ...att,
        id: `att-${Date.now()}-${index}`,
        url: att.url ?? '#',
      })),
      approvalSteps: approvalSteps.map((step, index) => ({
        id: `step-${Date.now()}-${index}`,
        ...step,
        status: 'pending' as const,
      })),
      signatures: requesterSignatureEntry,
      status: pdfSourceFile ? ('draft' as FormStatus) : ('pending' as FormStatus),
    };

    try {
      if (pdfSourceFile && !generatedPdfUrl) {
        toast.error('Please save the edited PDF before submitting');
        return;
      }

      if (draftCreated) {
        await updateForm(formId, {
          status: 'pending',
          title,
          description,
          type: formType,
          formData,
          approvalSteps: approvalSteps.map((step, index) => ({
            id: step.id ?? `step-${Date.now()}-${index}`,
            ...step,
            status: 'pending' as const,
          })),
          attachments: attachments.map((att, index) => ({
            ...att,
            id: att.id ?? `att-${Date.now()}-${index}`,
            url: att.url ?? '#',
          })),
        });
      } else {
        const createdForm = await addForm(baseForm);
        if (!createdForm) {
          throw new Error('Failed to create form');
        }
      }

      toast.success('Form submitted successfully!');
      navigate('/submissions');
    } catch (error: any) {
      console.error('Form submission failed:', error);
      toast.error(error?.message || 'Unable to submit form');
    }
  };

  const normalizeRole = (role: string) => role.trim().toLowerCase();
  const normalizeDepartment = (department: string) => department.trim().toLowerCase();

  const findMatchingUserForStep = (role: string, department: string) => {
    const targetRole = normalizeRole(role);
    const targetDepartment = normalizeDepartment(department);

    // Strict matching: must match both role AND department, no fallback
    if (!targetRole.trim() || !targetDepartment.trim()) {
      return null;
    }

    return availableUsers.find((user) =>
      normalizeRole(user.role) === targetRole &&
      normalizeDepartment(user.department || '') === targetDepartment
    ) ?? null;
  };

  const getApproverOptions = (role: string, department: string) => {
    // Strict matching: must match both role AND department, no fallback
    if (!role.trim() || !department.trim()) {
      return [];
    }

    const targetRole = normalizeRole(role);
    const targetDepartment = normalizeDepartment(department);

    return availableUsers.filter((user) =>
      normalizeRole(user.role) === targetRole &&
      normalizeDepartment(user.department || '') === targetDepartment
    );
  };

  const hasExactApproverForStep = (role: string, department: string) => {
    if (!role.trim() || !department.trim()) return false;
    return availableUsers.some((user) =>
      normalizeRole(user.role) === normalizeRole(role) &&
      normalizeDepartment(user.department || '') === normalizeDepartment(department)
    );
  };

  const buildApprovalSteps = (type: FormType) => {
    return approvalChains[type].map((step, index) => {
      const matchedUser = findMatchingUserForStep(step.role, '');
      return {
        id: `step-${Date.now()}-${index}`,
        role: step.role,
        department: '',
        userId: matchedUser?.id || '',
        userName: matchedUser?.name || '',
      };
    });
  };

  const updateApprovalStepRole = (index: number, role: string) => {
    const currentDepartment = approvalSteps[index]?.department || '';
    // Clear user selection when role changes, as user must match both role AND department
    const matchedUser = findMatchingUserForStep(role, currentDepartment);
    setApprovalSteps((prev) => prev.map((step, idx) => {
      if (idx !== index) return step;
      return {
        ...step,
        role,
        // Clear user if no match for new role+department combination
        userId: matchedUser?.id || '',
        userName: matchedUser?.name || '',
      };
    }));
  };

  const updateApprovalStepDepartment = (index: number, department: string) => {
    const currentRole = approvalSteps[index]?.role || '';
    const matchedUser = findMatchingUserForStep(currentRole, department);
    setApprovalSteps((prev) => prev.map((step, idx) => {
      if (idx !== index) return step;
      return {
        ...step,
        department,
        // Clear user if no match for new role+department combination
        userId: matchedUser?.id || '',
        userName: matchedUser?.name || '',
      };
    }));
  };

  const handleApproverChange = (index: number, userId: string) => {
    const user = availableUsers.find((item) => item.id === userId);
    if (!user) return;

    setApprovalSteps((prev) => prev.map((step, idx) => {
      if (idx !== index) return step;
      return {
        ...step,
        userId: user.id,
        userName: user.name,
      };
    }));
  };

  const addApprovalStep = () => {
    setApprovalSteps((prev) => [
      ...prev,
      { id: `step-${Date.now()}-${prev.length}`, role: '', department: '', userId: '', userName: '' },
    ]);
  };

  const applyTemplateApprovalChain = () => {
    if (!selectedTemplateId || templateApprovalSteps.length === 0) {
      return;
    }

    setApprovalSteps(templateApprovalSteps.map((step, index) => ({
      ...step,
      id: `template-step-${Date.now()}-${index}`,
    })));
    toast.success('Template default approval chain applied');
  };

  const removeApprovalStep = (index: number) => {
    setApprovalSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  useEffect(() => {
    if (!formType) {
      setApprovalSteps([]);
      return;
    }

    if (selectedTemplateId) {
      return;
    }

    setApprovalSteps(buildApprovalSteps(formType));
  }, [formType, selectedTemplateId]);

  useEffect(() => {
    if (!formType || approvalSteps.length === 0) {
      return;
    }

    setApprovalSteps((prevSteps) => prevSteps.map((step) => {
      if (step.userId || !step.role.trim()) {
        return step;
      }
      const matchedUser = findMatchingUserForStep(step.role, step.department);
      return matchedUser ? {
        ...step,
        userId: matchedUser.id,
        userName: matchedUser.name,
      } : step;
    }));
  }, [availableUsers, formType]);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Submit New Form</h1>
          <p className="text-gray-600">Fill out the form details and attach required documents</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Form Information</CardTitle>
              <CardDescription>Provide details about your request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {userLoadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {userLoadError}
                </div>
              )}
              {formTemplates.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="templateSelect">Request Template *</Label>
                  <Select value={selectedTemplateId} onValueChange={(value) => applySelectedTemplate(value)}>
                    <SelectTrigger id="templateSelect">
                      <SelectValue placeholder="Select an admin-created form" />
                    </SelectTrigger>
                    <SelectContent>
                      {formTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title} ({template.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplateId && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                      <div className="font-medium">Selected template</div>
                      <div>{formTemplates.find((template) => template.id === selectedTemplateId)?.description}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const template = formTemplates.find((template) => template.id === selectedTemplateId);
                            if (template?.pdfUrl) previewPdf(template.pdfUrl);
                          }}
                          disabled={isLoadingPdfPreview}
                        >
                          {isLoadingPdfPreview ? 'Loading preview...' : 'Preview template PDF'}
                        </Button>

                      </div>
                      {templateApprovalSteps.length > 0 && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">
                          <div className="font-medium">Admin default approval chain</div>
                          <ul className="mt-2 space-y-2">
                            {templateApprovalSteps.map((step, index) => (
                              <li key={step.id} className="flex items-center gap-2">
                                <span className="font-semibold">{index + 1}.</span>
                                <span>{step.role}</span>
                                {step.userName && <span className="text-slate-500">— {step.userName}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="formType">Form Type *</Label>
                  <Select value={formType} onValueChange={(value) => setFormType(value as FormType)}>
                    <SelectTrigger id="formType">
                      <SelectValue placeholder="Select form type" />
                    </SelectTrigger>
                    <SelectContent>
                      {formTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter form title"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide detailed description of your request"
                  rows={5}
                  required
                />
              </div>

              {currentUser.signatureURL && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  Your uploaded signature image will be attached to this submission.
                </div>
              )}

              {/* Form-specific fields */}
              {formType === 'Meal Request' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventDate">Event Date</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="participants">Number of Participants</Label>
                    <Input
                      id="participants"
                      type="number"
                      placeholder="50"
                      onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {formType === 'Item Request' && (
                <div className="space-y-2">
                  <Label htmlFor="estimatedAmount">Estimated Amount (PHP)</Label>
                  <Input
                    id="estimatedAmount"
                    type="number"
                    placeholder="100000"
                    onChange={(e) => setFormData({ ...formData, estimatedAmount: e.target.value })}
                  />
                </div>
              )}

              {/* Approval Chain Preview */}
              {formType && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <Label>Approval Chain</Label>
                      <p className="text-sm text-gray-600">Pick the default chain or adjust it by adding/removing approval roles.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplateId && templateApprovalSteps.length > 0 && (
                        <Button type="button" variant="outline" size="sm" onClick={applyTemplateApprovalChain}>
                          Use template default chain
                        </Button>
                      )}
                      <Button type="button" variant="secondary" size="sm" onClick={addApprovalStep}>
                        Add approval role
                      </Button>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Enter a role for each approval step and select the matching approver. Role matching is case-insensitive.
                    </p>
                    <div className="space-y-4">
                      {approvalSteps.map((step, index) => (
                        <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] items-start text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
                                {index + 1}
                              </div>
                              <div className="font-medium">Approval step</div>
                            </div>
                            <Select value={step.role} onValueChange={(value) => updateApprovalStepRole(index, value)}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {approvalRoleOptions.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={step.department} onValueChange={(value) => updateApprovalStepDepartment(index, value)}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                              <SelectContent>
                                {approvalDepartmentOptions.map((department) => (
                                  <SelectItem key={department} value={department}>
                                    {department}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="text-gray-500 text-xs">Choose a role and department for each approval step.</div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Approver</Label>
                            <Select
                              value={step.userId}
                              onValueChange={(value) => handleApproverChange(index, value)}
                              disabled={!step.role.trim() || !step.department.trim()}
                            >
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder={step.role.trim() && step.department.trim() ? 'Select approver' : 'Choose role and department first'} />
                              </SelectTrigger>
                              <SelectContent>
                                {getApproverOptions(step.role, step.department).map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name} {user.role ? `(${user.role})` : ''}{user.department ? ` - ${user.department}` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => removeApprovalStep(index)}
                          >
                            Remove
                          </Button>
                          {!hasExactApproverForStep(step.role, step.department) && step.role.trim() && step.department.trim() && (
                            <p className="text-xs text-orange-600 col-span-full">
                              No matching approver found for "{step.role}" in {step.department}. Please select an available user manually.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!selectedTemplateId && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sourcePdf">Upload Document</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-2">Upload the PDF you want to send for approval</p>
                      <Input
                        id="sourcePdf"
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (file && file.type !== 'application/pdf') {
                            toast.error('Please select a PDF file');
                            return;
                          }
                          setPdfSourceFile(file);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('sourcePdf')?.click()}
                      >
                        Select PDF
                      </Button>
                      {pdfSourceFile && (
                        <>
                          <p className="text-xs text-gray-500 mt-2">{pdfSourceFile.name}</p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-2 border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100"
                            onClick={() => setShowPdfEditor(true)}
                          >
                            Modify PDF
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <Dialog open={showPdfEditor} onOpenChange={setShowPdfEditor}>
                    <DialogContent className="w-full max-w-[90vw] sm:max-w-5xl max-h-[calc(100vh-6rem)] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>Modify PDF</DialogTitle>
                      </DialogHeader>
                      {approvalSteps.length > 0 && (
                        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          <p className="font-medium text-slate-900">Approval chain for this submission</p>
                          <ul className="mt-2 space-y-2">
                            {approvalSteps.map((step, index) => (
                              <li key={index} className="flex flex-col gap-1">
                                <span className="font-semibold">Step {index + 1}: {step.role || 'Untitled role'}</span>
                                <span className="text-slate-600">{step.userName ? step.userName : 'No approver selected yet'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pdfSourceFile && (
                        <PdfEditor
                          file={pdfSourceFile}
                          annotations={pdfAnnotations}
                          onChange={setPdfAnnotations}
                          onClose={() => setShowPdfEditor(false)}
                          isSaving={isGeneratingPdf}
                          currentUserId={currentUser.id}
                          currentUserSignatureURL={currentUser.signatureURL ?? null}
                          approvalSteps={approvalSteps}
                        />
                      )}
                    </DialogContent>
                  </Dialog>

                  {generatedPdfUrl && (
                    <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4">
                      <p className="text-sm text-green-900">Generated PDF ready.</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    <Button
                      type="button"
                      variant="default"
                      className="mt-4 w-full sm:w-auto px-6"
                      onClick={handleSavePdf}
                      disabled={isGeneratingPdf}
                    >
                      {isGeneratingPdf ? 'Saving PDF...' : 'Save PDF'}
                    </Button>
                    <p className="text-xs text-gray-500 mt-3 sm:mt-0">
                      Save the edited PDF before submitting your request.
                    </p>
                  </div>
                </>
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
            <DialogContent className="w-full max-w-[90vw] sm:max-w-5xl max-h-[calc(100vh-6rem)] overflow-auto p-0">
              <div className="flex h-full flex-col bg-white">
                <DialogHeader className="px-6 py-4 border-b">
                  <DialogTitle>Preview PDF</DialogTitle>
                  <DialogDescription>Preview the selected template document in read-only mode.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-auto">
                  {pdfViewerUrl ? (
                    <iframe src={pdfViewerUrl} title="PDF Preview" className="w-full h-[80vh] border-0" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
                      No PDF available for preview.
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col sm:flex-row sm:gap-4 w-full">
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
                disabled={
                  (!pdfSourceFile && attachments.length === 0) ||
                  approvalSteps.length === 0 ||
                  approvalSteps.some((step) => !step.role.trim() || !step.userId)
                }
              >
                Submit Form
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>
              {draftCreated && (
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={handleDeleteDraft}
                >
                  Delete Draft
                </Button>
              )}
            </div>
            {draftCreated && (
              <p className="text-sm text-gray-600 mt-2">
                A draft has been saved. Use Delete Draft to discard it and start over.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
