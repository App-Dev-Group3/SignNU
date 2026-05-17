import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, FileCheck } from 'lucide-react';

const allowedEmailPattern = /^(?:[A-Za-z0-9._%+-]+@(?:nu-laguna\.edu\.ph|students\.nu-laguna\.edu\.ph|shs\.students\.nu-laguna\.edu\.ph))$/;

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useWorkflow();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    const result = await login(email.trim().toLowerCase(), password);
    if (result.success) {
      toast.success('Login successful!');
      navigate('/');
    } else {
      setPassword('');
      if (result.pending) {
        toast.error(result.message || 'Email is pending admin approval');
      } else {
        toast.error(result.message || 'Invalid email or password');
      }
    }

    setIsLoading(false);
  };

  const handleForgotPassword = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const query = normalizedEmail ? `?email=${encodeURIComponent(normalizedEmail)}` : '';
    navigate(`/reset-password${query}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 flex flex-col">

      {/* NAVBAR */}
      <div className="w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="px-3 py-2 flex items-center gap-2">

          <div className="w-5 h-5 bg-[#d8b638] rounded flex items-center justify-center">
            <FileCheck className="w-3 h-3 text-white" />
          </div>

          <div className="leading-tight">
            <h1 className="text-xs font-bold text-[#35408e]">SignNU</h1>
            <p className="text-[12px] text-gray-500">NU Laguna</p>
          </div>

        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex items-start justify-center px-6 pt-10">

        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* LEFT PANEL (REMOVED GRADIENT) */}
          <div className="hidden lg:block space-y-6 text-[#35408e]">

            <h2 className="text-5xl font-extrabold tracking-tight leading-tight text-[#35408e]">
              Digital Signature{" "}
                <span className="bg-gradient-to-r from-[#35408e] to-[#d8b638] bg-clip-text text-transparent">
                   Platform
                </span>
            </h2>

            <p className="text-[#35408e]/70 text-lg">
              Streamline your workflows with electronic signatures and secure document processing.
            </p>

            <div className="space-y-4">

              {/* FAST PROCESSING */}
              <div className="flex items-start gap-3 p-2">
                <div className="w-10 h-10 bg-[#3B82F6] rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>

                <div>
                  <h3 className="font-semibold text-[#35408e] leading-tight">
                    Fast Processing
                  </h3>
                  <p className="text-sm text-[#35408e]/70">
                    Submit and approve documents instantly
                  </p>
                </div>
              </div>

              {/* SECURE SYSTEM */}
              <div className="flex items-start gap-3 p-2">
                <div className="w-10 h-10 bg-[#7C3AED] rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110">
                  <Lock className="w-5 h-5 text-white" />
                </div>

                <div>
                  <h3 className="font-semibold text-[#35408e] leading-tight">
                    Secure System
                  </h3>
                  <p className="text-sm text-[#35408e]/70">
                    Enterprise-grade security for all records
                  </p>
                </div>
              </div>

              {/* CENTRALIZED ACCESS */}
              <div className="flex items-start gap-3 p-2">
                <div className="w-10 h-10 bg-[#EF4444] rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110">
                  <Mail className="w-5 h-5 text-white" />
                </div>

                <div>
                  <h3 className="font-semibold text-[#35408e] leading-tight">
                    Centralized Access
                  </h3>
                  <p className="text-sm text-[#35408e]/70">
                    All documents in one secure platform
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT PANEL - LOGIN (GRADIENT MOVED HERE) */}
          <div className="w-full">

            <Card className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-[#35408e]/10 shadow-2xl rounded-xl">

              {/* moved soft gradient here */}
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#35408e]/10 rounded-full blur-3xl" />

              {/* accent bar (UNCHANGED) */}
              <div className="h-1 w-full bg-gradient-to-r from-[#35408e] to-[#d8b638]" />

              <CardHeader className="space-y-2 pb-6 relative z-10">
                <CardTitle className="text-4xl font-bold text-[#35408e] tracking-tight">
                  Login
                </CardTitle>

                <CardDescription className="text-gray-600">
                  Sign in to your account
                </CardDescription>
              </CardHeader>

              <CardContent className="relative z-10">
                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* EMAIL */}
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 h-12 focus:border-[#35408e] focus:ring-2 focus:ring-[#35408e]/20 transition-all"
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
                        className="pl-12 h-12 focus:border-[#35408e] focus:ring-2 focus:ring-[#35408e]/20 transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* BUTTON */}
                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#35408e] hover:scale-[1.02] hover:bg-[#2c3577] transition-all shadow-lg shadow-[#35408e]/20 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : (
                      <>
                        <LogIn className="w-5 h-5 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full h-12 mt-3"
                    onClick={handleForgotPassword}
                  >
                    Forgot password? Reset it here
                  </Button>

                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-[#35408e] font-semibold hover:underline">
                    Sign up
                  </Link>
                </div>


              </CardContent>
            </Card>
          </div>


        </div>
      </div>

      {/* FOOTER (RESTORED ORIGINAL) */}
      <footer className="mt-10 flex flex-col items-center pb-4">
        <div className="w-90 border-t border-gray-200 shadow-lg" />
        <p className="text-[11px] text-gray-500 mt-2 text-center">
          © {new Date().getFullYear()} SignNU • National University Laguna
        </p>
      </footer>

    </div>
  );
}