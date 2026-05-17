import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useWorkflow, FormType, FormStatus } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Upload, X } from 'lucide-react';
import { PdfEditor, PdfAnnotation } from '../components/PdfEditor';

const formTypes: FormType[] = ['ACP', 'Meal Request', 'RI', 'RFP', 'Item Request'];

const approvalChains: Record<FormType, Array<{ role: string; userId: string; userName: string }>> = {
  'ACP': [
    { role: 'SDAO Assistant', userId: 'user-1', userName: 'SDAO Assistant' },
    { role: 'SDAO Coordinator', userId: 'user-2', userName: 'SDAO Coordinator' },
    { role: 'SDAO Supervisor', userId: 'user-3', userName: 'SDAO Supervisor' },
    { role: 'Academic Services Director', userId: 'user-4', userName: 'Academic Services Director' },
    { role: 'Executive Director / Senior Academic Director', userId: 'user-5', userName: 'Executive Director / Senior Academic Director' },
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
  const [formData, setFormData] = useState<Record<string, any>>({
    adviserSigned: false,
    requiresDeanSignature: false,
    deanSigned: false,
  });
  const [attachments, setAttachments] = useState<Array<{ id?: string; name: string; size: number; type: string; url?: string }>>([]);
  const [supportingDocs, setSupportingDocs] = useState<Array<{ id: string; name: string; size: number; type: string; url?: string }>>([]);
  const [templatePdfFile, setTemplatePdfFile] = useState<File | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; role: string; department?: string }>>([]);
  type ApprovalRoleOption = { id: string; name: string; officeId?: string | null };
  const [approvalRoleOptions, setApprovalRoleOptions] = useState<ApprovalRoleOption[]>([]);
  const [approvalSteps, setApprovalSteps] = useState<Array<{ id?: string; role: string; roleId?: string; officeId?: string | null; department: string; userId: string; userName: string; templateDepartmentManual?: boolean }>>([]);
  const [templateApprovalSteps, setTemplateApprovalSteps] = useState<Array<{ id?: string; role: string; roleId?: string; officeId?: string | null; department: string; userId: string; userName: string; templateDepartmentManual?: boolean }>>([]);
  const [formTemplates, setFormTemplates] = useState<Array<any>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const CUSTOM_TEMPLATE_VALUE = '__custom_template__';
  const [managedRoleNames, setManagedRoleNames] = useState<string[]>([]);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [pdfSourceFile, setPdfSourceFile] = useState<File | null>(null);
  const [pdfAnnotations, setPdfAnnotations] = useState<PdfAnnotation[]>([]);
  const [showPdfEditor, setShowPdfEditor] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('');
  const [draftCreated, setDraftCreated] = useState(false);
  const [templateChainApplied, setTemplateChainApplied] = useState(false);
  const [isCustomApprovalChain, setIsCustomApprovalChain] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [isLoadingPdfPreview, setIsLoadingPdfPreview] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
  const [offices, setOffices] = useState<Array<{ id: string; name: string; imageUrl?: string }>>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
  const [officeName, setOfficeName] = useState('');
  const [editingOfficeId, setEditingOfficeId] = useState('');
  const [officeError, setOfficeError] = useState<string | null>(null);
  const [officeLoadError, setOfficeLoadError] = useState<string | null>(null);
  const [isSavingOffice, setIsSavingOffice] = useState(false);
  const [officeImageUrl, setOfficeImageUrl] = useState<string>('');
  const [officeImageFile, setOfficeImageFile] = useState<File | null>(null);

  const normalizeText = (value: string | undefined | null) => {
    if (!value) return '';
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  };

  const isValidUrl = (value: string | undefined | null) => {
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.href);
      return ['http:', 'https:', 'blob:', 'data:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const getApprovalRoleLabel = (option: ApprovalRoleOption) => {
    const office = option.officeId ? offices.find((office) => office.id === option.officeId)?.name : undefined;
    return office ? `${option.name} (${office})` : option.name;
  };

  const approvalRoleSelectionOptions: ApprovalRoleOption[] = (() => {
    const optionMap = new Map<string, ApprovalRoleOption>();
    const getKey = (option: ApprovalRoleOption) => `${normalizeText(option.name)}|${option.officeId || ''}`;

    approvalRoleOptions.forEach((option) => {
      const key = getKey(option);
      if (normalizeText(option.name) && !optionMap.has(key)) {
        optionMap.set(key, option);
      }
    });

    Object.values(approvalChains)
      .flatMap((chain) => chain.map((step) => step.role))
      .forEach((roleName) => {
        const normalized = normalizeText(roleName);
        const key = `${normalized}|`;
        if (normalized && !optionMap.has(key)) {
          optionMap.set(key, { id: roleName.trim(), name: roleName.trim(), officeId: null });
        }
      });

    return Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

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
          .filter((user: { role: string }) => normalizeText(user.role) !== 'student');
        
        setAvailableUsers(processedUsers);

        // Extract unique roles and departments from available users
        const uniqueRoleMap = new Map<string, string>();
        processedUsers.forEach((user: any) => {
          const normalized = normalizeText(user.role);
          if (normalized && !uniqueRoleMap.has(normalized)) {
            uniqueRoleMap.set(normalized, user.role.trim());
          }
        });

        const uniqueRoles = Array.from(uniqueRoleMap.values())
          .sort()
          .map((name) => ({ id: name, name }));

        if (managedRoleNames.length === 0) {
          setApprovalRoleOptions(uniqueRoles);
        }
        setUserLoadError(null);
      } catch (error: any) {
        console.error('Error loading approvers:', error);
        setUserLoadError(error.message || 'Failed to load approvers');
      }
    };

    fetchUsers();
  }, [API_BASE_URL, managedRoleNames.length]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/roles?detail=true`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Unable to load roles: ${response.status} ${errorText}`);
          return;
        }
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          if (typeof data[0] === 'object' && data[0] !== null) {
            const roles = data
              .map((role: any) => ({
                id: String(role.id || role.name || ''),
                name: String(role.name || '').trim(),
                officeId: role.officeId || null,
              }))
              .filter((role: any) => role.name.length > 0);
            setManagedRoleNames(roles.map((role) => role.name));
            setApprovalRoleOptions(roles);
          } else {
            const normalizedRoleNames = data
              .map((role: any) => String(role || '').trim())
              .filter((role: string) => role.length > 0);
            setManagedRoleNames(normalizedRoleNames);
            setApprovalRoleOptions(normalizedRoleNames.map((name) => ({ id: name, name })));
          }
        }
      } catch (error) {
        console.warn('Error loading shared roles:', error);
      }
    };

    fetchRoles();
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

  const fetchOffices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/offices`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to load offices: ${response.status} ${message}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Unexpected office response format');
      }

      setOffices(data.map((office: any) => ({ id: office.id || office._id, name: office.name || office, imageUrl: office.imageUrl || '' })));
      setOfficeLoadError(null);
    } catch (error: any) {
      console.error('Unable to load offices:', error);
      setOfficeLoadError(error?.message || 'Unable to load offices');
    }
  };

  useEffect(() => {
    fetchOffices();
  }, [API_BASE_URL]);

  useEffect(() => {
    if (!selectedOfficeId && offices.length > 0) {
      const firstOffice = offices[0];
      setSelectedOfficeId(firstOffice.id);
      setFormData((prev) => ({ ...prev, office: firstOffice.name }));
      setOfficeImageUrl(firstOffice.imageUrl || '');
    }
  }, [offices, selectedOfficeId]);

  const selectOffice = (officeId: string) => {
    const office = offices.find((item) => item.id === officeId);
    setSelectedOfficeId(officeId);
    if (office) {
      setFormData((prev) => ({ ...prev, office: office.name }));
      setOfficeImageUrl(office.imageUrl || '');
    }
    const selectedTemplate = formTemplates.find((template) => template.id === selectedTemplateId);
    if (selectedTemplate && selectedTemplate.officeId && selectedTemplate.officeId !== officeId) {
      setSelectedTemplateId('');
      setTemplateApprovalSteps([]);
      setTemplateChainApplied(false);
      setIsCustomApprovalChain(false);
    }
  };

  const availableTemplates = useMemo(() => {
    return formTemplates.filter((template) => {
      if (!template.officeId) return true;
      return template.officeId === selectedOfficeId;
    });
  }, [formTemplates, selectedOfficeId]);

  const openOfficeDialog = (office?: { id: string; name: string; imageUrl?: string | null }) => {
    setEditingOfficeId(office?.id ?? '');
    setOfficeName(office?.name ?? '');
    setOfficeImageUrl(office?.imageUrl ?? '');
    setOfficeImageFile(null);
    setOfficeError(null);
    setOfficeDialogOpen(true);
  };

  const refreshOffices = async () => {
    await fetchOffices();
  };

  const convertFileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file')); 
      }
    };
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

  const handleOfficeImageChange = async (file: File | null) => {
    if (!file) {
      setOfficeImageFile(null);
      setOfficeImageUrl('');
      return;
    }

    const imageUrl = await convertFileToDataUrl(file);
    setOfficeImageFile(file);
    setOfficeImageUrl(imageUrl);
  };

  const handleOfficeSave = async () => {
    if (!officeName.trim()) {
      setOfficeError('Office name is required');
      return;
    }

    setIsSavingOffice(true);
    try {
      const url = editingOfficeId ? `${API_BASE_URL}/api/offices/${editingOfficeId}` : `${API_BASE_URL}/api/offices`;
      const method = editingOfficeId ? 'PUT' : 'POST';
      const payload = new FormData();
      payload.append('name', officeName.trim());
      const imageIsDataUrl = officeImageUrl?.startsWith('data:');
      if (officeImageFile) {
        payload.append('imageFile', officeImageFile);
      } else if (officeImageUrl && !imageIsDataUrl) {
        payload.append('imageUrl', officeImageUrl);
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: buildAuthHeaders(),
        body: payload,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Unable to ${editingOfficeId ? 'update' : 'create'} office`);
      }

      const savedOffice = { id: data.id, name: data.name, imageUrl: data.imageUrl || '' };
      setOffices((prev) => {
        if (editingOfficeId) {
          return prev.map((office) => (office.id === savedOffice.id ? savedOffice : office));
        }
        return [savedOffice, ...prev];
      });
      setSelectedOfficeId(savedOffice.id);
      setFormData((prev) => ({ ...prev, office: savedOffice.name }));
      setOfficeDialogOpen(false);
      setEditingOfficeId('');
      setOfficeName('');
      setOfficeError(null);
    } catch (error: any) {
      console.error('Unable to save office:', error);
      setOfficeError(error?.message || 'Unable to save office');
    } finally {
      setIsSavingOffice(false);
    }
  };

  const handleEditOffice = (office: { id: string; name: string; imageUrl?: string | null }) => {
    openOfficeDialog(office);
  };

  const handleDeleteOffice = async (officeId: string) => {
    const confirmed = window.confirm('Delete this office? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/offices/${officeId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Unable to delete office');
      }
      setOffices((prev) => prev.filter((office) => office.id !== officeId));
      if (selectedOfficeId === officeId) {
        const nextOffice = offices.find((office) => office.id !== officeId);
        if (nextOffice) {
          selectOffice(nextOffice.id);
        } else {
          setSelectedOfficeId('');
          setFormData((prev) => {
            const next = { ...prev };
            delete next.office;
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Unable to delete office:', error);
      toast.error('Unable to delete office');
    }
  };

  const loadTemplatePdfFile = async (template: any) => {
    if (!template?.pdfUrl) return null;

    try {
      const response = await fetch(template.pdfUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const file = new File([blob], `${template.title || 'template'}.pdf`, { type: 'application/pdf' });
      setTemplatePdfFile(file);
      setPdfSourceFile(file);
      return file;
    } catch (error) {
      console.warn('Could not load template PDF file', error);
      return null;
    }
  };

  const resetToDefaultChain = (type?: FormType, templateId?: string) => {
    const selectedFormType = type || formType;

    if (templateId || selectedTemplateId) {
      const template = formTemplates.find((item) => item.id === (templateId || selectedTemplateId));
      if (template) {
        const mappedTemplateSteps = (template.approvalSteps || []).map((step: any, index: number) => ({
          id: step.id || `template-step-${Date.now()}-${index}`,
          role: step.role || '',
          department: step.department || '',
          userId: step.userId || '',
          userName: step.userName || '',
          templateDepartmentManual: step.department === MANUAL_DEPARTMENT_VALUE,
        }));
        setApprovalSteps(mappedTemplateSteps);
        setTemplateChainApplied(true);
        return;
      }
    }

    if (selectedFormType) {
      setApprovalSteps(buildApprovalSteps(selectedFormType));
      setTemplateChainApplied(false);
    }
  };

  const enableCustomApprovalChain = () => {
    setIsCustomApprovalChain(true);
  };

  const disableCustomApprovalChain = () => {
    setIsCustomApprovalChain(false);
    resetToDefaultChain();
  };

  const applySelectedTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);

    if (!templateId || templateId === CUSTOM_TEMPLATE_VALUE) {
      setAttachments([]);
      setSupportingDocs([]);
      setTemplatePdfFile(null);
      setGeneratedPdfUrl('');
      setTemplateApprovalSteps([]);
      setApprovalSteps([]);
      setTemplateChainApplied(false);
      setIsCustomApprovalChain(true);
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
      templateDepartmentManual: step.department === MANUAL_DEPARTMENT_VALUE,
    }));

    setFormType(template.type);
    setTitle(template.title);
    setDescription(template.description);
    setTemplateApprovalSteps(mappedTemplateSteps);
    setTemplateChainApplied(!isCustomApprovalChain);
    if (!isCustomApprovalChain) {
      setApprovalSteps(mappedTemplateSteps);
    }
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
    setPdfAnnotations([]);
    if (template.officeId) {
      const matchedOffice = offices.find((office) => office.id === template.officeId);
      if (matchedOffice) {
        setSelectedOfficeId(matchedOffice.id);
        setFormData((prev) => ({ ...prev, office: matchedOffice.name }));
        setOfficeImageUrl(matchedOffice.imageUrl || '');
      }
    }
    await loadTemplatePdfFile(template);
  };

  const isCustomTemplate = (templateId: string) => templateId === CUSTOM_TEMPLATE_VALUE;

  useEffect(() => {
    if (!selectedTemplateId || isCustomTemplate(selectedTemplateId)) {
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
      templateDepartmentManual: step.department === MANUAL_DEPARTMENT_VALUE,
    }));

    setTemplateApprovalSteps(mappedTemplateSteps);
    if (!isCustomApprovalChain) {
      setApprovalSteps(mappedTemplateSteps);
      setTemplateChainApplied(true);
    }
  }, [selectedTemplateId, formTemplates, isCustomApprovalChain]);

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
    const sourcePdf = pdfSourceFile || templatePdfFile;
    if (!sourcePdf) {
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
          role: step.role,
          roleId: step.roleId,
          userId: step.userId,
          userName: step.userName,
          department: step.department,
          officeId: step.officeId,
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
        sourcePdf,
        textFields,
        currentUser.signatureURL ?? null,
        null,
        pdfAnnotations
      );
      if (!pdfUrl || !isValidUrl(pdfUrl)) {
        throw new Error('Received invalid PDF URL from server');
      }
      setGeneratedPdfUrl(pdfUrl);
      setAttachments([
        { name: sourcePdf.name, size: sourcePdf.size, type: sourcePdf.type, url: pdfUrl },
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
      setTemplatePdfFile(null);
      setPdfAnnotations([]);
      setAttachments([]);
      setSupportingDocs([]);
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

  const handleSupportingDocsUpload = (files: FileList | null) => {
    if (!files?.length) return;
    const newFiles = Array.from(files).map((file, index) => ({
      id: `support-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      url: URL.createObjectURL(file),
    }));
    setSupportingDocs((prev) => [...prev, ...newFiles]);
  };

  const removeSupportingDoc = (id: string) => {
    setSupportingDocs((prev) => prev.filter((doc) => doc.id !== id));
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

    if (!draftCreated) {
      toast.error('Please save the PDF draft before submitting your request');
      return;
    }

    if (formType === 'ACP' && !formData.adviserSigned) {
      toast.error('ACP requests must include an adviser signature before submission');
      return;
    }

    if (formType === 'ACP' && formData.requiresDeanSignature && !formData.deanSigned) {
      toast.error('This ACP requires a dean signature before submission');
      return;
    }

    if (approvalSteps.length === 0 || approvalSteps.some((step) => !step.role.trim() || !step.userId)) {
      toast.error('Please enter a role and select an approver for every approval step');
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
      attachments: [
        ...attachments.map((att, index) => ({
          ...att,
          id: `att-${Date.now()}-${index}`,
          url: att.url ?? '#',
        })),
        ...supportingDocs.map((att, index) => ({
          ...att,
          id: `support-${Date.now()}-${index}`,
          url: att.url ?? '#',
        })),
      ],
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
            role: step.role,
            roleId: step.roleId,
            userId: step.userId,
            userName: step.userName,
            department: step.department,
            officeId: step.officeId,
            status: 'pending' as const,
          })),
          attachments: [
            ...attachments.map((att, index) => ({
              ...att,
              id: att.id ?? `att-${Date.now()}-${index}`,
              url: att.url ?? '#',
            })),
            ...supportingDocs.map((att, index) => ({
              ...att,
              id: att.id ?? `support-${Date.now()}-${index}`,
              url: att.url ?? '#',
            })),
          ],
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

  const MANUAL_DEPARTMENT_VALUE = '__MANUAL_DEPARTMENT__';
  const MANUAL_DEPARTMENT_LABEL = 'Manual (requester chooses department)';
  const isManualDepartment = (department: string) => normalizeText(department) === normalizeText(MANUAL_DEPARTMENT_VALUE);
  const normalizeRole = (role: string) => normalizeText(role);

  const findMatchingUserForStep = (role: string, department?: string) => {
    const targetRole = normalizeRole(role);
    const normalizedDepartment = department ? normalizeText(department) : '';

    if (!targetRole) {
      return null;
    }

    return availableUsers.find((user) => {
      const matchesRole = normalizeRole(user.role) === targetRole;
      if (!matchesRole) return false;
      if (!normalizedDepartment) return true;
      return normalizeText(user.department) === normalizedDepartment;
    }) ?? null;
  };

  const getApproverOptions = (role: string, department?: string) => {
    if (!normalizeRole(role)) {
      return [];
    }

    const targetRole = normalizeRole(role);
    const normalizedDepartment = department ? normalizeText(department) : '';
    if (isManualDepartment(department || '')) {
      return [];
    }

    return availableUsers.filter((user) => {
      const matchesRole = normalizeRole(user.role) === targetRole;
      if (!matchesRole) return false;
      if (!normalizedDepartment) return true;
      return normalizeText(user.department) === normalizedDepartment;
    });
  };

  const hasExactApproverForStep = (role: string, department?: string) => {
    if (!normalizeRole(role)) return false;
    const targetRole = normalizeRole(role);
    const normalizedDepartment = department ? normalizeText(department) : '';
    return availableUsers.some((user) => {
      const matchesRole = normalizeRole(user.role) === targetRole;
      if (!matchesRole) return false;
      if (!normalizedDepartment || isManualDepartment(department || '')) return true;
      return normalizeText(user.department) === normalizedDepartment;
    });
  };

  const buildApprovalSteps = (type: FormType) => {
    return approvalChains[type].map((step, index) => {
      const matchedUser = findMatchingUserForStep(step.role);
      return {
        id: `step-${Date.now()}-${index}`,
        role: step.role,
        roleId: undefined,
        officeId: undefined,
        department: '',
        userId: matchedUser?.id || '',
        userName: matchedUser?.name || '',
      };
    });
  };

  const updateApprovalStepRole = (index: number, roleId: string) => {
    const selectedRole = approvalRoleSelectionOptions.find((option) => option.id === roleId)
      || approvalRoleSelectionOptions.find((option) => normalizeText(option.name) === normalizeText(roleId))
      || { id: roleId, name: roleId, officeId: undefined };
    const matchedUser = findMatchingUserForStep(selectedRole.name);
    setApprovalSteps((prev) => prev.map((step, idx) => {
      if (idx !== index) return step;
      return {
        ...step,
        role: selectedRole.name,
        roleId: selectedRole.id,
        officeId: selectedRole.officeId || undefined,
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
        templateDepartmentManual: step.templateDepartmentManual,
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
      { id: `step-${Date.now()}-${prev.length}`, role: '', roleId: undefined, officeId: undefined, department: '', userId: '', userName: '' },
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
    setTemplateChainApplied(true);
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

    if (selectedTemplateId || isCustomApprovalChain) {
      return;
    }

    setApprovalSteps(buildApprovalSteps(formType));
    setTemplateChainApplied(false);
  }, [formType, selectedTemplateId, isCustomApprovalChain]);

  useEffect(() => {
    if (!formType || approvalSteps.length === 0) {
      return;
    }

    setApprovalSteps((prevSteps) => prevSteps.map((step) => {
      const matchedRole = approvalRoleOptions.find((option) => normalizeRole(option.name) === normalizeRole(step.role));
      const matchedUser = step.userId || !step.role.trim() ? null : findMatchingUserForStep(step.role);
      return {
        ...step,
        roleId: step.roleId || matchedRole?.id,
        officeId: step.officeId || matchedRole?.officeId || undefined,
        userId: step.userId || matchedUser?.id || '',
        userName: step.userName || matchedUser?.name || step.userName,
      };
    }));
  }, [availableUsers, formType, approvalRoleOptions]);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Submit New Form</h1>
          <p className="text-gray-600">Fill out the form details and attach required documents</p>
        </div>

        <div className="mb-8">
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Choose a request office</h2>
                <p className="text-sm text-gray-600">Select the office that should own this form. Admins can manage offices.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-40 w-60 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
                  {offices.find((office) => office.id === selectedOfficeId)?.imageUrl ? (
                    <img
                      src={offices.find((office) => office.id === selectedOfficeId)?.imageUrl}
                      alt="Selected office location"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-center text-sm text-slate-500 px-2">
                      No image
                      <span className="block text-[11px] text-slate-400">add location photo</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {currentUser.role === 'Admin' && (
                    <Button type="button" onClick={() => openOfficeDialog()}>
                      Add Office
                    </Button>
                  )}
                </div>
              </div>
            </div>

          {officeLoadError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {officeLoadError}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {offices.length > 0 ? (
              offices.map((office) => {
                const isSelected = selectedOfficeId === office.id;
                return (
                  <div key={office.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectOffice(office.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${isSelected ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}
                    >
                      {office.name}
                    </button>
                    {currentUser.role === 'Admin' && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" type="button" size="sm" onClick={() => handleEditOffice(office)}>
                          Edit
                        </Button>
                        <Button variant="ghost" type="button" size="sm" className="text-red-600" onClick={() => handleDeleteOffice(office.id)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">Loading offices...</p>
            )}
            <Button type="button" variant="secondary" onClick={() => applySelectedTemplate(CUSTOM_TEMPLATE_VALUE)}>
              Custom chain
            </Button>
          </div>

          {selectedOfficeId && (
            <p className="mt-2 text-sm text-slate-600">
              Selected office: {offices.find((office) => office.id === selectedOfficeId)?.name}
            </p>
          )}
        </div>

        <Dialog open={officeDialogOpen} onOpenChange={setOfficeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOfficeId ? 'Edit Office' : 'Create Office'}</DialogTitle>
              <DialogDescription>
                {editingOfficeId
                  ? 'Update the office name that requesters can select.'
                  : 'Add a new office for request routing.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Label htmlFor="officeName">Office Name</Label>
              <Input
                id="officeName"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="e.g. Accounting"
              />
              <div className="space-y-2">
                <Label htmlFor="officeImage">Location Picture</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {officeImageUrl ? (
                      <img src={officeImageUrl} alt="Office location" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-center text-xs text-slate-500 p-2">
                        No picture
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      id="officeImage"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0] ?? null;
                        await handleOfficeImageChange(file);
                      }}
                    />
                    <Button type="button" onClick={() => document.getElementById('officeImage')?.click()}>
                      Upload picture
                    </Button>
                    {officeImageUrl && (
                      <Button type="button" variant="outline" onClick={() => handleOfficeImageChange(null)}>
                        Remove picture
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {officeError && <div className="text-sm text-red-600">{officeError}</div>}
            </div>
            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setOfficeDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleOfficeSave} disabled={isSavingOffice}>
                {isSavingOffice ? 'Saving...' : editingOfficeId ? 'Save Changes' : 'Create Office'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                      <SelectValue placeholder="Select an admin-created form or custom request" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="custom" value={CUSTOM_TEMPLATE_VALUE}>
                        Custom request (manual approval chain)
                      </SelectItem>
                      {availableTemplates.length === 0 && (
                        <SelectItem key="no-templates" value="no-templates" disabled>
                          No templates available for selected office
                        </SelectItem>
                      )}
                      {availableTemplates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title} ({template.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplateId === CUSTOM_TEMPLATE_VALUE && (
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
                  {selectedTemplateId && !isCustomTemplate(selectedTemplateId) && (
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
                      <div className="mt-4 text-sm">
                        <div className={templateChainApplied ? 'text-slate-700' : 'text-orange-700'}>
                          {templateChainApplied
                            ? 'Template approval chain has been applied to this draft.'
                            : 'Template approval chain is not used yet for this draft.'}
                        </div>
                        <div className="mt-1 text-slate-600">
                          {templatePdfFile && (pdfAnnotations.length > 0 || generatedPdfUrl !== formTemplates.find((template) => template.id === selectedTemplateId)?.pdfUrl)
                            ? 'Template copy has been edited.'
                            : 'Template copy has not been edited yet.'}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {templatePdfFile && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowPdfEditor(true)}
                          >
                            Edit template copy
                          </Button>
                        )}
                        {templatePdfFile && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (generatedPdfUrl) {
                                previewPdf(generatedPdfUrl);
                              } else if (templatePdfFile) {
                                previewPdf(URL.createObjectURL(templatePdfFile));
                              }
                            }}
                            disabled={isLoadingPdfPreview}
                          >
                            {isLoadingPdfPreview ? 'Loading preview...' : 'Preview template copy'}
                          </Button>
                        )}
                      </div>
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

              {formType === 'ACP' && (
                <div className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <h2 className="text-sm font-semibold text-orange-800">ACP Signature Requirements</h2>
                  <p className="text-sm text-orange-700">
                    Before submission, confirm the adviser signature. If Dean approval is required, mark it below and confirm the dean signature as well.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Adviser signature attached</Label>
                      <select
                        value={formData.adviserSigned ? 'yes' : 'no'}
                        onChange={(e) => setFormData({ ...formData, adviserSigned: e.target.value === 'yes' })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Dean signature required</Label>
                      <select
                        value={formData.requiresDeanSignature ? 'yes' : 'no'}
                        onChange={(e) => setFormData({ ...formData, requiresDeanSignature: e.target.value === 'yes', deanSigned: false })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {formData.requiresDeanSignature && (
                      <div className="space-y-2">
                        <Label>Dean signature attached</Label>
                        <select
                          value={formData.deanSigned ? 'yes' : 'no'}
                          onChange={(e) => setFormData({ ...formData, deanSigned: e.target.value === 'yes' })}
                          className="w-full border rounded-lg px-3 py-2"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Approval Chain Preview */}
              {formType && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <Label>Approval Chain</Label>
                      <p className="text-sm text-gray-600">
                        {isCustomApprovalChain
                          ? 'You are editing a custom approval chain. Add or change steps as needed.'
                          : 'Using the default approval chain. Press Customize to change the approval sequence.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={isCustomApprovalChain ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={isCustomApprovalChain ? disableCustomApprovalChain : enableCustomApprovalChain}
                      >
                        {isCustomApprovalChain ? 'Use default chain' : 'Customize chain'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addApprovalStep}
                        disabled={!isCustomApprovalChain}
                      >
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
                        <div key={step.id || index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] items-start text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
                                {index + 1}
                              </div>
                              <div className="font-medium">Approval step</div>
                            </div>
                            <Select value={step.roleId || step.role || ''} onValueChange={(value) => updateApprovalStepRole(index, value)} disabled={!isCustomApprovalChain}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {approvalRoleSelectionOptions.map((option) => (
                                  <SelectItem key={`${option.id}-${option.officeId || 'global'}`} value={option.id}>
                                    {getApprovalRoleLabel(option)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="text-gray-500 text-xs">Choose a role for each approval step and then select the matching approver.</div>
                          </div>
                          <div className="space-y-2">
                            {step.templateDepartmentManual && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Department</Label>
                                <Select
                                  value={step.department === MANUAL_DEPARTMENT_VALUE ? '' : step.department}
                                  onValueChange={(value) => updateApprovalStepDepartment(index, value)}
                                  disabled={!step.role.trim()}
                                >
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select department" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(new Set(availableUsers.map((user) => user.department).filter(Boolean))).sort().map((department) => (
                                      <SelectItem key={department} value={department!}>
                                        {department}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">Choose the department for this step so the right approver can be assigned.</p>
                              </div>
                            )}
                            <Label className="text-sm font-medium">Approver</Label>
                            <Select
                              value={step.userId}
                              onValueChange={(value) => handleApproverChange(index, value)}
                              disabled={!step.role.trim() || (step.templateDepartmentManual && step.department === MANUAL_DEPARTMENT_VALUE) || (!isCustomApprovalChain && !step.templateDepartmentManual)}
                            >
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder={step.role.trim() ? (isManualDepartment(step.department) ? 'Select approver after department' : 'Select approver') : 'Choose a role first'} />
                              </SelectTrigger>
                              <SelectContent>
                                {getApproverOptions(step.role, isManualDepartment(step.department) ? step.department : step.department).map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name} {user.role ? `(${user.role})` : ''}{user.department ? ` — ${user.department}` : ''}
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
                            disabled={!isCustomApprovalChain}
                          >
                            Remove
                          </Button>
                          {!hasExactApproverForStep(step.role) && step.role.trim() && (
                            <p className="text-xs text-orange-600 col-span-full">
                              No matching approver found for "{step.role}". Please select an available user manually.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Supporting Documents</Label>
                    <p className="text-sm text-gray-600">Upload extra files such as quotes, guest lists, or permits.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('supportingDocs')?.click()}
                  >
                    Upload Documents
                  </Button>
                </div>
                <input
                  id="supportingDocs"
                  type="file"
                  multiple
                  onChange={(e) => handleSupportingDocsUpload(e.target.files)}
                  className="hidden"
                />
                {supportingDocs.length > 0 ? (
                  <div className="space-y-2">
                    {supportingDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-slate-500">{Math.round(doc.size / 1024)} KB</div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSupportingDoc(doc.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No supporting documents uploaded yet.</p>
                )}
              </div>

              <>
                {/* <div className="space-y-2">
                  <Label htmlFor="sourcePdf">Document</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {!selectedTemplateId ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 mb-2">Edit this template copy for your request.</p>
                        <div className="text-left">
                          <p className="font-medium">{formTemplates.find((template) => template.id === selectedTemplateId)?.title}</p>
                          <p className="text-xs text-gray-500">{formTemplates.find((template) => template.id === selectedTemplateId)?.type}</p>
                        </div>
                        <div className="mt-4 flex flex-wrap justify-center gap-3">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowPdfEditor(true)}
                          >
                            Edit template copy
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (generatedPdfUrl) {
                                previewPdf(generatedPdfUrl);
                              } else if (templatePdfFile) {
                                previewPdf(URL.createObjectURL(templatePdfFile));
                              }
                            }}
                            disabled={isLoadingPdfPreview}
                          >
                            {isLoadingPdfPreview ? 'Loading preview...' : 'Preview template copy'}
                          </Button>
                        </div>
                      </>
                    )} */}

                    {/* {((pdfSourceFile && !selectedTemplateId) || (selectedTemplateId && templatePdfFile)) && (
                      <div className="mt-4 text-sm text-gray-500">
                        <p>{(selectedTemplateId ? templatePdfFile?.name : pdfSourceFile?.name) || 'Ready to edit'}</p>
                      </div>
                    )}
                  </div>
                </div> */}

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
                            <li key={step.id || index} className="flex flex-col gap-1">
                              <span className="font-semibold">Step {index + 1}: {step.role || 'Untitled role'}</span>
                              <span className="text-slate-600">{step.userName ? step.userName : 'No approver selected yet'}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(pdfSourceFile || templatePdfFile) && (
                      <PdfEditor
                        file={pdfSourceFile || templatePdfFile!}
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
                  !draftCreated ||
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
