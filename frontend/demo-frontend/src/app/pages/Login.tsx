import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, FileCheck, Sparkles, Shield, Zap } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const { login } = useWorkflow();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    const success = await login(email, password);
    if (success) {
      toast.success('Login successful!');
      navigate('/');
    } else {
      toast.error('Invalid email or password');
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Please enter your email first');
      return;
    }

    setIsForgotLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api/users/forgot-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      if (!res.ok) {
        toast.error('Failed to send reset email');
        return;
      }

      toast.success('Password reset email sent!');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          {/* LEFT SIDE (unchanged) */}
          <div className="hidden lg:block space-y-8 text-white">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50">
                  <FileCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">SignNU</h1>
                  <p className="text-sm text-blue-200">NU Laguna</p>
                </div>
              </div>

              <h2 className="text-5xl font-bold leading-tight">
                Digital Signature<br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Platform
                </span>
              </h2>

              <p className="text-xl text-blue-100 leading-relaxed">
                Streamline your workflows with AI-powered form management,
                electronic signatures, and real-time collaboration.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="w-full">
            <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-xl">
              <CardHeader className="space-y-2 pb-6">
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-base">
                  Sign in to access your dashboard
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* EMAIL */}
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 h-12"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-12 h-12"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* FORGOT PASSWORD */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isForgotLoading}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {isForgotLoading ? 'Sending...' : 'Forgot password?'}
                    </button>
                  </div>

                  {/* LOGIN BUTTON */}
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-blue-600 font-semibold">
                      Sign up
                    </Link>
                  </p>
                </div>

              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}