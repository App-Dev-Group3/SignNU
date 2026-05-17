import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, ShieldCheck } from 'lucide-react';

const allowedEmailPattern = /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph|shs\.students\.nu-laguna\.edu\.ph))$/;

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [sendCooldown, setSendCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const urlToken = searchParams.get('token') || '';
    const urlEmail = searchParams.get('email') || '';
    if (urlEmail) {
      setEmail(urlEmail.toLowerCase().trim());
    }
    if (urlToken) {
      setToken(urlToken);
      setIsVerified(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (sendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setSendCooldown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sendCooldown]);

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  const handleSendResetEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Please enter your email first');
      return;
    }
    if (!allowedEmailPattern.test(normalizedEmail)) {
      toast.error('Email must end with @nu-laguna.edu.ph, @students.nu-laguna.edu.ph, or @shs.students.nu-laguna.edu.ph');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(`${apiBase}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Failed to send password reset email');
        return;
      }
      setIsSent(true);
      setSendCooldown(60);
      toast.success('Password reset email sent! Check your inbox for the code or token link.');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong while sending the reset email.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !code.trim()) {
      toast.error('Email and reset code are required for verification');
      return;
    }
    if (!allowedEmailPattern.test(normalizedEmail)) {
      toast.error('Email must end with @nu-laguna.edu.ph, @students.nu-laguna.edu.ph, or @shs.students.nu-laguna.edu.ph');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch(`${apiBase}/api/users/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, code: code.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Invalid or expired reset code');
        return;
      }
      setIsVerified(true);
      toast.success('Reset code verified. You can now enter a new password.');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong while verifying the reset code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      toast.error('Password is required');
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d)[A-Za-z0-9]{8,}$/.test(newPassword)) {
      toast.error('Password must be at least 8 characters, alphanumeric, and contain an uppercase letter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsResetting(true);
    try {
      const body = token
        ? { token, newPassword }
        : { email: email.trim().toLowerCase(), code: code.trim(), newPassword };
      const res = await fetch(`${apiBase}/api/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || 'Failed to reset password');
        return;
      }
      toast.success('Password reset successfully. Please sign in with your new password.');
      navigate('/login');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong while resetting your password.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl bg-white/90 border border-[#35408e]/10 shadow-2xl rounded-3xl">
        <CardHeader className="space-y-2 p-8 text-center">
          <CardTitle className="text-4xl font-bold text-[#35408e]">Reset Password</CardTitle>
          <CardDescription className="text-gray-600">
            Enter your NU Laguna email to receive a reset code, then verify before choosing a new password.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 p-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-12 focus:border-[#35408e] focus:ring-2 focus:ring-[#35408e]/20"
                  disabled={isSending || isVerified || !!token}
                />
              </div>
            </div>

            {!token && (
              <div className="space-y-2">
                <Label>Reset Code</Label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-12 focus:border-[#35408e] focus:ring-2 focus:ring-[#35408e]/20"
                  disabled={isVerified}
                />
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {!token && (
                <Button
                  type="button"
                  className="h-12"
                  onClick={handleSendResetEmail}
                  disabled={isSending || !email.trim() || sendCooldown > 0}
                >
                  {sendCooldown > 0
                    ? `Wait ${sendCooldown}s to resend`
                    : isSending
                    ? 'Sending reset email...'
                    : 'Send reset email'}
                </Button>
              )}

              {!token && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12"
                  onClick={handleVerifyCode}
                  disabled={isVerifying || !email.trim() || !code.trim()}
                >
                  {isVerifying ? 'Verifying...' : 'Verify reset code'}
                </Button>
              )}
            </div>

            {isVerified ? (
              <>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-12 h-12 focus:border-[#35408e] focus:ring-2 focus:ring-[#35408e]/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-12 h-12 focus:border-[#35408e] focus:ring-2 focus:ring-[#35408e]/20"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full h-12"
                  onClick={handleResetPassword}
                  disabled={isResetting || !newPassword || !confirmPassword}
                >
                  {isResetting ? 'Resetting password...' : 'Reset password'}
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#35408e]/40 bg-[#f8fafc] p-4 text-sm text-[#334155]">
                Verify your reset code first to show the password fields.
              </div>
            )}

            <div className="text-sm text-gray-600">
              Only NU Laguna emails are accepted for password recovery: @nu-laguna.edu.ph, @students.nu-laguna.edu.ph, and @shs.students.nu-laguna.edu.ph.
            </div>

            <div className="text-center text-sm text-gray-600">
              Remembered your password?{' '}
              <Link to="/login" className="text-[#35408e] font-semibold hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
