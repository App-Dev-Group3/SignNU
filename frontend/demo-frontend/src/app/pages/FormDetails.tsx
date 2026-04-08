import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
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
  Upload,
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
    addAttachment, 
    currentUser,
    // generateQRSession,
    sendNudge,
    generateAISummary,
  } = useWorkflow();
  const [comments, setComments] = useState('');
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  // const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  // const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  // const [qrSessionLink, setQrSessionLink] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [signature, setSignature] = useState('');
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
  const canApprove = currentStep?.userId === currentUser.id && currentStep?.status === 'pending';
  const canAddSignature = form.approvalSteps.some(
    step => step.userId === currentUser.id && step.status !== 'pending'
  );
  const isCurrentSigner = currentStep?.userId === currentUser.id && currentStep?.status === 'pending';
  const canOpenSignatureDialog = canAddSignature || isCurrentSigner;
  const signatureButtonLabel = isCurrentSigner ? 'Sign & Approve' : 'Add Signature';
  const signatureDialogDescription = isCurrentSigner
    ? 'Sign and approve this document to complete your step.'
    : 'Draw your signature in the box below.';

  const handleApprove = () => {
    if (currentStep) {
      approveStep(form.id, currentStep.id, comments);
      toast.success('Form approved successfully');
      setComments('');
    }
  };

  const handleReject = () => {
    if (!comments.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    if (currentStep) {
      rejectStep(form.id, currentStep.id, comments);
      toast.error('Form rejected');
      setComments('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        addAttachment(form.id, {
          name: file.name,
          size: file.size,
          type: file.type,
          url: '#',
        });
      });
      toast.success(`${files.length} file(s) added`);
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

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const signatureData = canvas.toDataURL();
    addSignature(form.id, {
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      signature: signatureData,
    });

    if (isCurrentSigner && currentStep) {
      approveStep(form.id, currentStep.id, 'Signed and approved');
      toast.success('Signature added and step approved');
    } else {
      toast.success('Signature added successfully');
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

  const handleSendNudge = () => {
    sendNudge(form.id);
    toast.success('Nudge sent successfully');
  };

  const handleGenerateAISummary = async () => {
    setIsGeneratingAI(true);
    await generateAISummary(form.id);
    setIsGeneratingAI(false);
  };

  const handleDownloadPDF = () => {
    const formData = getFormById(form.id);
    if (!formData) return;
    
    // Check if form is finalized
    const allSigned = formData.approvalSteps.every(step => step.status === 'approved');
    
    if (!allSigned) {
      toast.error('Cannot download PDF. Form is not yet finalized.');
      return;
    }
    
    // Create a simple text-based PDF content
    const pdfContent = `
SIGNNU - NU LAGUNA
Form Approval Document

Form Type: ${formData.type}
Title: ${formData.title}
Description: ${formData.description}

Submitted By: ${formData.submittedBy}
Submitted At: ${format(new Date(formData.submittedAt), 'PPpp')}
Status: ${formData.status.toUpperCase()}

FORM DATA:
${Object.entries(formData.formData).map(([key, value]) => `${key}: ${value}`).join('\n')}

APPROVAL CHAIN:
${formData.approvalSteps.map((step, index) => 
  `${index + 1}. ${step.role} - ${step.userName}
     Status: ${step.status.toUpperCase()}
     ${step.comments ? `Comments: ${step.comments}` : ''}
     ${step.timestamp ? `Date: ${format(new Date(step.timestamp), 'PPpp')}` : ''}
  `).join('\n')}

SIGNATURES:
${formData.signatures.map((sig, index) => 
  `${index + 1}. ${sig.userName} (${sig.role})
     Signed: ${format(new Date(sig.signedAt), 'PPpp')}`).join('\n')}

ATTACHMENTS:
${formData.attachments.map((att, index) => `${index + 1}. ${att.name} (${(att.size / 1024).toFixed(2)} KB)`).join('\n')}

---
Document generated on ${format(new Date(), 'PPpp')}
This is an official document from SignNU - NU Laguna
    `;
    
    // Create a blob and download
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formData.type}_${formData.id}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Document downloaded successfully!');
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
            {Object.keys(form.formData).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Form Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(form.formData).map(([key, value]) => (
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
                <div className="flex items-center justify-between">
                  <CardTitle>Attachments</CardTitle>
                  <div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Add Files
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {form.attachments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No attachments</p>
                ) : (
                  <div className="space-y-2">
                    {form.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{attachment.name}</p>
                            <p className="text-xs text-gray-500">
                              {(attachment.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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

            {/* Signatures */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Electronic Signatures</CardTitle>
                  {canOpenSignatureDialog && (
                    <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <PenTool className="w-4 h-4 mr-2" />
                          {signatureButtonLabel}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>{signatureButtonLabel}</DialogTitle>
                          <DialogDescription>
                            {signatureDialogDescription}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="border-2 border-gray-300 rounded-lg">
                            <canvas
                              ref={canvasRef}
                              width={400}
                              height={200}
                              onMouseDown={startDrawing}
                              onMouseMove={draw}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                              className="w-full cursor-crosshair"
                              style={{ touchAction: 'none' }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={clearSignature} variant="outline" className="flex-1">
                              Clear
                            </Button>
                            <Button onClick={saveSignature} className="flex-1">
                              Save Signature
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {form.signatures.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No signatures yet</p>
                ) : (
                  <div className="space-y-4">
                    {form.signatures.map((sig) => (
                      <div key={sig.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">{sig.userName}</p>
                            <p className="text-sm text-gray-600">{sig.role}</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {format(new Date(sig.signedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <div className="border border-gray-200 rounded bg-white p-2">
                          <img src={sig.signature} alt={`${sig.userName}'s signature`} className="h-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
                  <p className="text-gray-600 mb-1">Attachments</p>
                  <p className="font-medium">{form.attachments.length} files</p>
                </div>
                <Separator />
                <div>
                  <p className="text-gray-600 mb-1">Signatures</p>
                  <p className="font-medium">{form.signatures.length} collected</p>
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
                <Button onClick={handleSendNudge} variant="outline" size="sm">
                  <Bell className="w-4 h-4 mr-2" />
                  Send Nudge
                </Button>
                <Button onClick={handleGenerateAISummary} variant="outline" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Summary
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
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