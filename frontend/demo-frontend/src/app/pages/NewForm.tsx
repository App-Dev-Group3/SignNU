import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useWorkflow, FormType, FormStatus } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
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
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  if (!currentUser) {
    return null;
  }

  const formIdRef = useRef(`form-${Date.now()}`);
  const [formType, setFormType] = useState<FormType | ''>('');
  const [title, setTitle] = useState('');
  const isValidUrl = (value: string | undefined | null) => {
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.href);
      return ['http:', 'https:', 'blob:', 'data:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };
  const [description, setDescription] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<Array<{ id?: string; name: string; size: number; type: string; url?: string }>>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [approvalSteps, setApprovalSteps] = useState<Array<{ role: string; userId: string; userName: string }>>([]);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [pdfSourceFile, setPdfSourceFile] = useState<File | null>(null);
  const [pdfAnnotations, setPdfAnnotations] = useState<PdfAnnotation[]>([]);
  const [showPdfEditor, setShowPdfEditor] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('');
  const [draftCreated, setDraftCreated] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load users: ${response.status} ${errorText}`);
        }
        const fetchedUsers = await response.json();
        setAvailableUsers(fetchedUsers.map((user: any) => ({
          id: user._id || user.id,
          name: user.username || user.name || user.email,
          role: user.role,
        })));
        setUserLoadError(null);
      } catch (error: any) {
        console.error('Error loading approvers:', error);
        setUserLoadError(error.message || 'Failed to load approvers');
      }
    };

    fetchUsers();
  }, [API_BASE_URL]);

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

    if (!pdfSourceFile && attachments.length === 0) {
      toast.error('Please upload a PDF document before submitting your request');
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

  const getApproverOptions = (role: string) => {
    const target = normalizeRole(role);
    const exactMatches = availableUsers.filter((user) => normalizeRole(user.role) === target);
    return exactMatches.length > 0 ? exactMatches : availableUsers;
  };

  const hasExactApproverForRole = (role: string) =>
    availableUsers.some((user) => normalizeRole(user.role) === normalizeRole(role));

  const findMatchingUserForRole = (role: string) => {
    const target = normalizeRole(role);
    return availableUsers.find((user) => normalizeRole(user.role) === target) ?? null;
  };

  const buildApprovalSteps = (type: FormType) => {
    return approvalChains[type].map((step) => {
      const matchedUser = findMatchingUserForRole(step.role);
      return {
        role: step.role,
        userId: matchedUser?.id || '',
        userName: matchedUser?.name || '',
      };
    });
  };

  const updateApprovalStepRole = (index: number, role: string) => {
    const matchedUser = findMatchingUserForRole(role);
    setApprovalSteps((prev) => prev.map((step, idx) => {
      if (idx !== index) return step;
      return {
        ...step,
        role,
        userId: matchedUser?.id || step.userId,
        userName: matchedUser?.name || step.userName,
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
      { role: '', userId: '', userName: '' },
    ]);
  };

  const removeApprovalStep = (index: number) => {
    setApprovalSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  useEffect(() => {
    if (!formType) {
      setApprovalSteps([]);
      return;
    }

    setApprovalSteps(buildApprovalSteps(formType));
  }, [formType]);

  useEffect(() => {
    if (!formType || approvalSteps.length === 0) {
      return;
    }

    setApprovalSteps((prevSteps) => prevSteps.map((step) => {
      if (step.userId || !step.role.trim()) {
        return step;
      }
      const matchedUser = findMatchingUserForRole(step.role);
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
              {/* Form Type */}
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
                  {pdfSourceFile && (
                    <PdfEditor
                      file={pdfSourceFile}
                      annotations={pdfAnnotations}
                      onChange={setPdfAnnotations}
                      onClose={() => setShowPdfEditor(false)}
                      isSaving={isGeneratingPdf}
                      currentUserId={currentUser.id}
                      currentUserSignatureURL={currentUser.signatureURL ?? null}
                    />
                  )}
                </DialogContent>
              </Dialog>

              {generatedPdfUrl && (
                <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-900">Generated PDF ready.</p>
                  {/* <a
                    href={generatedPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-700 underline"
                  >
                    View saved PDF
                  </a> */}
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

              {/* Approval Chain Preview */}
              {formType && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <Label>Approval Chain</Label>
                      <p className="text-sm text-gray-600">Pick the default chain or adjust it by adding/removing approval roles.</p>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={addApprovalStep}>
                      Add approval role
                    </Button>
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
                            <Input
                              value={step.role}
                              onChange={(e) => updateApprovalStepRole(index, e.target.value)}
                              placeholder="Role name (e.g. Department Head)"
                            />
                            <div className="text-gray-500 text-xs">Role lookup ignores capitalization.</div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Approver</Label>
                            <Select value={step.userId} onValueChange={(value) => handleApproverChange(index, value)}>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select approver" />
                              </SelectTrigger>
                              <SelectContent>
                                {getApproverOptions(step.role).map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name} {user.role ? `(${user.role})` : ''}
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
                          {!hasExactApproverForRole(step.role) && step.role.trim() && (
                            <p className="text-xs text-orange-600 col-span-full">
                              No matching approver role found for "{step.role}". Please select an available user manually.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
