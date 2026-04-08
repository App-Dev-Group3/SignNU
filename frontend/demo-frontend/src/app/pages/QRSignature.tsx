import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

function QRSignatureContent() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { validateQRSession, useQRSession, getFormById } = useWorkflow();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [status, setStatus] = useState<'validating' | 'valid' | 'expired' | 'used' | 'success'>('validating');
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!token) return;

    const validatedSession = validateQRSession(token);
    
    if (!validatedSession) {
      setStatus('expired');
      return;
    }

    if (validatedSession.used) {
      setStatus('used');
      return;
    }

    setSession(validatedSession);
    const formData = getFormById(validatedSession.formId);
    setForm(formData);
    setStatus('valid');

    // Calculate time left
    const expiry = new Date(validatedSession.expiresAt).getTime();
    const now = Date.now();
    setTimeLeft(Math.max(0, Math.floor((expiry - now) / 1000)));

    // Update timer every second
    const timer = setInterval(() => {
      const expiry = new Date(validatedSession.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setStatus('expired');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [token]);

  const startDrawing = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
    
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

  const submitSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !session) return;
    
    const signatureData = canvas.toDataURL();
    
    const currentStep = form?.approvalSteps.find((s: any) => s.id === session.stepId);
    
    const success = useQRSession(token!, {
      userId: currentStep?.userId || 'qr-user',
      userName: currentStep?.userName || 'QR Signature',
      role: currentStep?.role || 'Signatory',
      signature: signatureData,
    });

    if (success) {
      setStatus('success');
    } else {
      setStatus('expired');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'validating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock className="w-16 h-16 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Validating QR code...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <XCircle className="w-16 h-16 text-red-600 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">QR Code Expired</h2>
            <p className="text-gray-600 text-center">
              This QR code has expired or is invalid. Please request a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'used') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="w-16 h-16 text-yellow-600 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Already Used</h2>
            <p className="text-gray-600 text-center">
              This QR code has already been used for signing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Signature Submitted!</h2>
            <p className="text-gray-600 text-center mb-6">
              Your signature has been successfully recorded.
            </p>
            <Button onClick={() => window.close()}>
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Sign Document via QR</CardTitle>
          <CardDescription>
            {form?.title}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timer Alert */}
          <Alert>
            <Clock className="w-4 h-4" />
            <AlertTitle>Time Remaining</AlertTitle>
            <AlertDescription>
              This QR code expires in <strong className="text-orange-600">{formatTime(timeLeft)}</strong>
            </AlertDescription>
          </Alert>

          {/* Form Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Document Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Form Type:</span>
                <span className="font-medium">{form?.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Submitted By:</span>
                <span className="font-medium">{form?.submittedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Your Role:</span>
                <span className="font-medium">
                  {form?.approvalSteps.find((s: any) => s.id === session?.stepId)?.role}
                </span>
              </div>
            </div>
          </div>

          {/* Signature Canvas */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Draw Your Signature</label>
            <div className="border-2 border-gray-300 rounded-lg bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full cursor-crosshair touch-none"
              />
            </div>
            <p className="text-xs text-gray-500">
              Draw your signature above using your finger or mouse
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={clearSignature} variant="outline" className="flex-1">
              Clear
            </Button>
            <Button onClick={submitSignature} className="flex-1">
              Submit Signature
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function QRSignature() {
  return <QRSignatureContent />;
}
