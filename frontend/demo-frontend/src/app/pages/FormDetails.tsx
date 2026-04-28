import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PdfEditor, PdfAnnotation } from '../components/PdfEditor';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
// import QRCode from 'qrcode';
import { 
  FileText, 
  Calendar, 
  User, 
  CheckCircle, 
  XCircle, 
  Clock,
  Download,
  MessageSquare,
  PenTool,

  ArrowLeft,
  QrCode,
  Bell,
  Sparkles,
  Share2,
} from 'lucide-react';
import { format } from 'date-fns';

export function FormDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    getFormById, 
    approveStep, 
    rejectStep, 
    addSignature, 
    removeSignature,
    currentUser,
    updateForm,
    generateFormPdf,
    deleteForm,
    // generateQRSession,
    sendNudge,
    generateAISummary,
  } = useWorkflow();

  if (!currentUser) {
    return null;
  }
  const [comments, setComments] = useState('');
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [signature, setSignature] = useState('');
  const [isPdfEditorOpen, setIsPdfEditorOpen] = useState(false);
  const [pdfEditorFile, setPdfEditorFile] = useState<File | null>(null);
  const [pdfEditorAnnotations, setPdfEditorAnnotations] = useState<PdfAnnotation[]>([]);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [isSavingPdfEditor, setIsSavingPdfEditor] = useState(false);
  const [isChainEditorOpen, setIsChainEditorOpen] = useState(false);
  const [chainSteps, setChainSteps] = useState<any[]>([]);
  const [isSavingChain, setIsSavingChain] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const form = getFormById(id || '');

  if (!form) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center py-16">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-600 mb-6">The form you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const currentStep = form.approvalSteps[form.currentStep];
  const safeFormData = form.formData ?? {};
  const isValidUrl = (value: string | undefined | null) => {
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.href);
      return ['http:', 'https:', 'blob:', 'data:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const pdfAttachment = form.attachments.find(
    (att) =>
      (att.type === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf')) &&
      isValidUrl(att.url)
  );
  const canApprove = currentStep?.userId === currentUser.id && currentStep?.status === 'pending';
  const canAddSignature = form.approvalSteps.some(
    step => step.userId === currentUser.id && step.status !== 'pending'
  );
  const isCurrentSigner = currentStep?.userId === currentUser.id && currentStep?.status === 'pending';
  const canOpenSignatureDialog = canAddSignature || isCurrentSigner;
  const canEditPending = currentUser.id === form.submittedById && form.status === 'pending';
  const signatureButtonLabel = isCurrentSigner ? 'Sign & Approve' : 'Add Signature';
  const signatureDialogDescription = isCurrentSigner
    ? 'Sign and approve this document to complete your step.'
    : 'Draw your signature in the box below.';
  const completedSignaturesCount = form.approvalSteps.filter((step) => step.status === 'approved').length;

  const handleApprove = async () => {
    if (currentStep) {
      await approveStep(form.id, currentStep.id, comments);
      toast.success('Form approved successfully');
      setComments('');
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    if (currentStep) {
      await rejectStep(form.id, currentStep.id, comments);
      toast.error('Form rejected');
      setComments('');
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getContext('2d');
    if (!rect) return;

    setIsDrawing(true);
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    rect.beginPath();
    rect.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const fetchPdfFileFromUrl = async (url: string, fileName: string) => {
    if (!isValidUrl(url)) {
      throw new Error('Invalid PDF URL');
    }

    if (url.startsWith('data:')) {
      const match = url.match(/^data:(.+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid data URL for PDF');
      }
      const mimeType = match[1];
      const data = match[2];
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      return new File([bytes], fileName, { type: mimeType });
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Unable to fetch PDF attachment');
    }
    const blob = await response.blob();
    return new File([blob], fileName, { type: 'application/pdf' });
  };

  const openPdfEditorForAttachment = async (att: { id?: string; name: string; url?: string }) => {
    if (!att.url || !isValidUrl(att.url)) {
      toast.error('Cannot edit PDF: attachment has no valid URL');
      return;
    }

    try {
      const file = await fetchPdfFileFromUrl(att.url, att.name);
      setPdfEditorFile(file);
      setPdfEditorAnnotations([]);
      setEditingAttachmentId(att.id ?? null);
      setIsPdfEditorOpen(true);
    } catch (error: any) {
      console.error('Unable to open PDF editor:', error);
      toast.error(error?.message || 'Failed to load PDF for editing');
    }
  };

  const savePdfEditorAnnotations = async () => {
    if (!pdfEditorFile || !editingAttachmentId) {
      toast.error('No PDF file loaded for placement');
      return;
    }

    const ownerSignature = form.signatures.find((sig) => sig.role === 'Requester')?.signature ?? null;
    const userSignature = form.signatures.find((sig) => sig.userId === currentUser.id)?.signature ?? null;
    const hasSignatureAnnotation = pdfEditorAnnotations.some(
      (annotation) => annotation.type === 'signature' && annotation.signatureData,
    );

    if (!hasSignatureAnnotation && !userSignature) {
      toast.error('Please save your signature first or place a signature annotation on the PDF');
      return;
    }

    setIsSavingPdfEditor(true);
    try {
      const generatedPdfUrl = await generateFormPdf(
        form.id,
        pdfEditorFile,
        {},
        ownerSignature,
        userSignature ?? null,
        pdfEditorAnnotations,
        editingAttachmentId,
      );

      await updateForm(form.id, {
        generatedPdfURL: generatedPdfUrl,
        attachments: form.attachments.map((att) =>
          att.id === editingAttachmentId ? { ...att, url: generatedPdfUrl } : att
        ),
      });

      toast.success('Signature placement saved to PDF');
      setIsPdfEditorOpen(false);
      setEditingAttachmentId(null);
      setPdfEditorFile(null);
      setPdfEditorAnnotations([]);
    } catch (error: any) {
      console.error('Saving PDF placement failed:', error);
      toast.error(error?.message || 'Failed to save signature placement on PDF');
    } finally {
      setIsSavingPdfEditor(false);
    }
  };

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  const openChainEditor = () => {
    setChainSteps(form.approvalSteps.map((step) => ({ ...step })));
    setIsChainEditorOpen(true);
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Unable to load users: ${res.status} ${text}`);
        }
        const data = await res.json();
        setAvailableUsers(
          data.map((user: any) => ({
            id: user._id ?? user.id,
            name: user.username ?? user.name ?? user.email,
            role: user.role ?? '',
          }))
        );
        setUserLoadError(null);
      } catch (error: any) {
        console.warn('Unable to load approver users:', error);
        setAvailableUsers([]);
        setUserLoadError(error.message || 'Unable to load approver users');
      }
    };

    loadUsers();
  }, [API_BASE_URL]);

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

  const updateChainStepRole = (index: number, role: string) => {
    const matchedUser = findMatchingUserForRole(role);
    setChainSteps((prev) => prev.map((step, idx) => {
      if (idx !== index) return step;
      return {
        ...step,
        role,
        userId: matchedUser?.id || step.userId,
        userName: matchedUser?.name || step.userName,
      };
    }));
  };

  const updateChainStep = (index: number, key: string, value: string) => {
    setChainSteps((prev) => prev.map((step, idx) => (idx === index ? { ...step, [key]: value } : step)));
  };

  const handleApproverChange = (index: number, userId: string) => {
    const user = availableUsers.find((item) => item.id === userId);
    if (!user) return;

    setChainSteps((prev) => prev.map((step, idx) => {
      if (idx !== index) return step;
      return {
        ...step,
        userId: user.id,
        userName: user.name,
      };
    }));
  };

  const addChainStep = () => {
    setChainSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: '',
        userId: '',
        userName: '',
        status: 'pending',
      },
    ]);
  };

  const removeChainStep = (index: number) => {
    setChainSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveChainSteps = async () => {
    if (chainSteps.length === 0) {
      toast.error('Approval chain must contain at least one step.');
      return;
    }

    setIsSavingChain(true);
    try {
      await updateForm(form.id, { approvalSteps: chainSteps });
      toast.success('Approval chain updated successfully');
      setIsChainEditorOpen(false);
    } catch (error) {
      console.error('Unable to update approval chain:', error);
      toast.error('Failed to update approval chain');
    } finally {
      setIsSavingChain(false);
    }
  };

  const regeneratePdfWithSignatures = async (newSignature: { userId: string; userName: string; role: string; signature: string }) => {
    const pdfUrl = pdfAttachment?.url || form.generatedPdfURL;
    if (!pdfUrl || !isValidUrl(pdfUrl)) {
      console.warn('Cannot regenerate signed PDF: missing valid PDF URL');
      return;
    }

    const ownerSignature = form.signatures.find((sig) => sig.role === 'Requester')?.signature ?? null;
    const assignedSignature = newSignature.signature;

    try {
      const pdfFile = await fetchPdfFileFromUrl(pdfUrl, pdfAttachment?.name ?? 'document.pdf');
      const generatedPdfUrl = await generateFormPdf(form.id, pdfFile, {}, ownerSignature, assignedSignature, []);

      await updateForm(form.id, {
        generatedPdfURL: generatedPdfUrl,
        attachments: form.attachments.map((att) =>
          att.id && pdfAttachment?.id && att.id === pdfAttachment.id ? { ...att, url: generatedPdfUrl } : att
        ),
      });

      toast.success('Signed PDF updated successfully');
    } catch (error: any) {
      console.warn('Could not regenerate signed PDF:', error);
    }
  };

  const isCanvasBlank = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < imageData.length; i += 4) {
      if (imageData[i] !== 0) {
        return false;
      }
    }
    return true;
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isCanvasBlank(canvas)) {
      toast.error('Please draw a signature before saving');
      return;
    }

    const signatureData = canvas.toDataURL();
    const newSignature = {
      id: `sig-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      signedAt: new Date().toISOString(),
      signature: signatureData,
    };

    try {
      await updateForm(form.id, {
        signatures: [...form.signatures, newSignature],
      });

      if (isCurrentSigner && currentStep) {
        await approveStep(form.id, currentStep.id, 'Signed and approved');
        toast.success('Signature added and step approved');
      } else {
        toast.success('Signature added successfully');
      }

      await regeneratePdfWithSignatures(newSignature);
    } catch (error: any) {
      console.error('Saving signature failed:', error);
      toast.error(error?.message || 'Unable to save signature');
      return;
    }

    setIsSignatureDialogOpen(false);
    clearSignature();
  };

  /* QR code signing feature is temporarily disabled.
  const handleGenerateQR = async () => {
    if (!currentStep) {
      toast.error('No pending approver to generate QR for');
      return;
    }
    
    const session = generateQRSession(form.id, currentStep.id);
    const link = `${window.location.origin}/qr/${session.token}`;
    setQrSessionLink(link);
    
    try {
      const qrCode = await QRCode.toDataURL(link);
      setQrCodeDataURL(qrCode);
      setIsQRDialogOpen(true);
      toast.success('QR Code generated! Valid for 10 minutes');
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };
  */

  const canSendNudge = form.submittedById === currentUser.id || currentUser.role === 'Admin';

  const handleSendNudge = async () => {
    if (!canSendNudge) {
      toast.error('Only the request owner or an admin can send a nudge');
      return;
    }

    await sendNudge(form.id);
  };

  const handleDeleteRequest = async () => {
    if ((form.status !== 'draft' && form.status !== 'pending') || form.submittedById !== currentUser.id) return;

    const confirmMessage =
      form.status === 'draft'
        ? 'Delete this draft? This action cannot be undone.'
        : 'Delete this pending request? This action cannot be undone.';

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    try {
      await deleteForm(form.id);
      toast.success(form.status === 'draft' ? 'Draft deleted successfully' : 'Pending request deleted successfully');
      navigate('/submissions');
    } catch (error) {
      console.error('Delete request failed:', error);
      toast.error('Unable to delete request');
    }
  };

  const previewPdfAttachment = async (pdfUrl: string) => {
    setIsLoadingPdf(true);
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) {
        throw new Error('Failed to load PDF');
      }
      let blob = await res.blob();
      if (blob.type !== 'application/pdf') {
        blob = new Blob([blob], { type: 'application/pdf' });
      }
      const blobUrl = URL.createObjectURL(blob);
      if (selectedPdfUrl) {
        URL.revokeObjectURL(selectedPdfUrl);
      }
      setSelectedPdfUrl(blobUrl);
      setIsPdfViewerOpen(true);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load PDF preview');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleGenerateAISummary = async () => {
    setIsGeneratingAI(true);
    await generateAISummary(form.id);
    setIsGeneratingAI(false);
  };

  const handleDownloadPDF = async () => {
    const formData = getFormById(form.id);
    if (!formData) return;

    const allSigned = formData.approvalSteps.every((step) => step.status === 'approved');

    if (!allSigned) {
      toast.error('Cannot download PDF. Form is not yet finalized.');
      return;
    }

    const pdfAttachment = formData.attachments.find(
      (att) => att.type === 'application/pdf' || att.name?.toLowerCase().endsWith('.pdf')
    );

    if (!pdfAttachment?.url) {
      toast.error('No signed PDF attachment is available for download.');
      return;
    }

    try {
      const response = await fetch(pdfAttachment.url);
      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }
      let blob = await response.blob();
      if (blob.type !== 'application/pdf') {
        blob = new Blob([blob], { type: 'application/pdf' });
      }

      const blobUrl = URL.createObjectURL(blob);
      const downloadName = pdfAttachment.name?.toLowerCase().endsWith('.pdf')
        ? pdfAttachment.name
        : `${formData.type}_${formData.id}.pdf`;

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success('PDF downloaded successfully!');
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error('Unable to download PDF');
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-semibold text-gray-900">{form.title}</h1>
                <Badge
                  variant={
                    form.status === 'approved'
                      ? 'default'
                      : form.status === 'rejected'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {form.status}
                </Badge>
              </div>
              <p className="text-gray-600">{form.description}</p>
            </div>
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>{form.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Submitted by {form.submittedBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(form.submittedAt), 'MMMM d, yyyy, h:mm a')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Summary */}
            {form.aiSummary && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <CardTitle>AI-Generated Summary</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{form.aiSummary}</p>
                </CardContent>
              </Card>
            )}

            {/* Form Data */}
            {Object.keys(safeFormData).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(safeFormData).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2 border-b last:border-0">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-sm text-gray-900">
                          {typeof value === 'object' && value !== null
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
                <CardDescription>
                  View the latest uploaded or generated PDF attachments for this form.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canEditPending && (
                  <div className="mb-4 flex justify-end">
                    <Button variant="secondary" size="sm" onClick={openChainEditor}>
                      Edit Approval Chain
                    </Button>
                  </div>
                )}
                {form.attachments.length === 0 ? (
                  <p className="text-sm text-gray-500">No attachments available.</p>
                ) : (
                  <div className="space-y-3">
                    {form.attachments.map((att) => (
                      <div key={att.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{att.name}</p>
                            <p className="text-sm text-gray-600">{(att.size / 1024).toFixed(2)} KB</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {att.url ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => previewPdfAttachment(att.url)}
                                  disabled={isLoadingPdf}
                                >
                                  {isLoadingPdf ? 'Loading...' : 'View PDF'}
                                </Button>
                                {canEditPending && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openPdfEditorForAttachment(att)}
                                  >
                                    Edit PDF
                                  </Button>
                                )}
                                {canOpenSignatureDialog && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openPdfEditorForAttachment(att)}
                                  >
                                    Place Signature
                                  </Button>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-500">No file URL</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog
              open={isPdfViewerOpen}
              onOpenChange={(open) => {
                setIsPdfViewerOpen(open);
                if (!open && selectedPdfUrl) {
                  URL.revokeObjectURL(selectedPdfUrl);
                  setSelectedPdfUrl(null);
                }
              }}
            >
              <DialogContent className="sm:max-w-4xl max-w-full h-[calc(100vh-5rem)] overflow-auto p-0">
                <div className="flex h-full flex-col bg-white">
                  <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Preview PDF</DialogTitle>
                    <DialogDescription>
                      Review the document in read-only mode.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-auto">
                    {selectedPdfUrl ? (
                      <iframe
                        src={selectedPdfUrl}
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

            <Dialog open={isPdfEditorOpen} onOpenChange={(open) => {
              setIsPdfEditorOpen(open);
              if (!open) {
                setPdfEditorFile(null);
                setEditingAttachmentId(null);
                setPdfEditorAnnotations([]);
              }
            }}>
              <DialogContent className="sm:max-w-4xl max-w-full h-[calc(100vh-5rem)] overflow-auto p-0">
                <div className="flex h-full flex-col bg-white">
                  <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Place your signature</DialogTitle>
                    <DialogDescription>
                      Drag your signature or text box to the desired location on the PDF.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-auto p-4">
                    {pdfEditorFile ? (
                      <PdfEditor
                        file={pdfEditorFile}
                        annotations={pdfEditorAnnotations}
                        onChange={setPdfEditorAnnotations}
                        onClose={() => setIsPdfEditorOpen(false)}
                        isSaving={isSavingPdfEditor}
                        currentUserId={currentUser.id}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
                        Loading PDF editor...
                      </div>
                    )}
                  </div>
                  <div className="border-t p-4 flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsPdfEditorOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={savePdfEditorAnnotations} disabled={isSavingPdfEditor}>
                      {isSavingPdfEditor ? 'Saving…' : 'Save placement'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isChainEditorOpen} onOpenChange={(open) => setIsChainEditorOpen(open)}>
              <DialogContent className="sm:max-w-4xl max-w-full h-[calc(100vh-5rem)] overflow-auto p-0">
                <div className="flex h-full flex-col bg-white">
                  <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Edit Approval Chain</DialogTitle>
                    <DialogDescription>
                      Update the pending approval steps for this request.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-auto p-4">
                    <div className="space-y-4">
                      {userLoadError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                          {userLoadError}
                        </div>
                      )}
                      {chainSteps.map((step, index) => (
                        <div key={step.id} className="rounded-lg border border-gray-200 p-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <Label htmlFor={`chain-role-${index}`}>Role</Label>
                              <Input
                                id={`chain-role-${index}`}
                                value={step.role}
                                onChange={(e) => updateChainStepRole(index, e.target.value)}
                                placeholder="Role name (e.g. Department Head)"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`chain-approver-${index}`}>Approver</Label>
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
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeChainStep(index)}
                              disabled={chainSteps.length <= 1}
                            >
                              Remove
                            </Button>
                          </div>
                          {!hasExactApproverForRole(step.role) && step.role.trim() && (
                            <p className="text-xs text-orange-600 mt-2">
                              No exact approver role found for "{step.role}". Select an approver manually.
                            </p>
                          )}
                        </div>
                      ))}
                      <Button variant="secondary" onClick={addChainStep}>
                        Add Step
                      </Button>
                    </div>
                  </div>
                  <div className="border-t p-4 flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsChainEditorOpen(false)}>
                      Close
                    </Button>
                    <Button onClick={saveChainSteps} disabled={isSavingChain}>
                      {isSavingChain ? 'Saving…' : 'Save Chain'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Approval Actions */}
            {canApprove && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Form</CardTitle>
                  <CardDescription>Approve or reject this form submission</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="comments">Comments (Optional)</Label>
                    <Textarea
                      id="comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Add your comments here..."
                      rows={4}
                      className="mt-2"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleApprove} className="flex-1">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button onClick={handleReject} variant="destructive" className="flex-1">
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Approval Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Approval Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {form.approvalSteps.map((step, index) => {
                    const isActive = index === form.currentStep;
                    const isPast = index < form.currentStep;
                    
                    return (
                      <div key={step.id} className="relative">
                        {index < form.approvalSteps.length - 1 && (
                          <div
                            className={`absolute left-4 top-8 w-0.5 h-12 ${
                              step.status === 'approved'
                                ? 'bg-green-500'
                                : step.status === 'rejected'
                                ? 'bg-red-500'
                                : 'bg-gray-200'
                            }`}
                          />
                        )}
                        
                        <div className="flex gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              step.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : step.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : isActive
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {step.status === 'approved' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : step.status === 'rejected' ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </div>
                          
                          <div className="flex-1 pb-4">
                            <p className="font-medium text-gray-900 text-sm">{step.role}</p>
                            <p className="text-xs text-gray-600">{step.userName}</p>
                            {step.status !== 'pending' && step.timestamp && (
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(step.timestamp), 'MMM d, h:mm a')}
                              </p>
                            )}
                            {step.comments && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                                <MessageSquare className="w-3 h-3 inline mr-1" />
                                {step.comments}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600 mb-1">Current Step</p>
                  <p className="font-medium">
                    {form.currentStep + 1} of {form.approvalSteps.length}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-gray-600 mb-1">Signatures</p>
                  <p className="font-medium">{completedSignaturesCount} collected</p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* QR code signing feature disabled
                <Button onClick={handleGenerateQR} variant="outline" size="sm">
                  <QrCode className="w-4 h-4 mr-2" />
                  Generate QR Code
                </Button>
                */}
                {form.status !== 'approved' && canSendNudge && (
                  <Button onClick={handleSendNudge} variant="outline" size="sm">
                    <Bell className="w-4 h-4 mr-2" />
                    Send Nudge
                  </Button>
                )}
                <Button onClick={handleGenerateAISummary} variant="outline" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Summary
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                {(form.status === 'draft' || form.status === 'pending') && form.submittedById === currentUser.id && (
                  <Button onClick={handleDeleteRequest} variant="destructive" size="sm">
                    <XCircle className="w-4 h-4 mr-2" />
                    {form.status === 'draft' ? 'Delete Draft' : 'Delete Request'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* QR Code Dialog
        <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code for Signature</DialogTitle>
              <DialogDescription>
                Share this QR code with {currentStep?.userName} to sign without login.
                <br />
                <span className="text-orange-600 font-medium">Expires in 10 minutes</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {qrCodeDataURL && (
                <div className="flex justify-center p-4 bg-white border rounded-lg">
                  <img src={qrCodeDataURL} alt="QR Code" className="w-64 h-64" />
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Direct Link:</p>
                <p className="text-xs font-mono text-gray-800 break-all">{qrSessionLink}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(qrSessionLink);
                    toast.success('Link copied to clipboard!');
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setIsQRDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        */}
      </div>
    </div>
  );
}