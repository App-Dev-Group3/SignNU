import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Mail, Lock, User, Briefcase, FileCheck, Sparkles, CheckCircle } from 'lucide-react';

export function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useWorkflow();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password || !formData.role || !formData.department) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    const success = await register(formData);
    if (success) {
      toast.success('Account created successfully!');
      navigate('/');
    } else {
      toast.error('Unable to create account. Email may already exist');
    }

    setIsLoading(false);
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-blue-50">

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

      {/* CONTENT */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-10">

        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          {/* LEFT SIDE */}
          <div className="hidden lg:block space-y-8 text-[#35408e]">

            <div className="space-y-6">

              <h2 className="text-5xl font-bold leading-tight">
                Join Our<br />
                <span className="bg-gradient-to-r from-[#35408e] to-[#d8b638] bg-clip-text text-transparent">
                  Digital Platform
                </span>
              </h2>

              <p className="text-xl text-[#35408e]/70 leading-relaxed">
                Create your account and experience the future of
                form management and digital signatures.
              </p>
            </div>

            {/* WHAT'S INCLUDED */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-[#35408e]/10 shadow-lg">
              <h3 className="font-semibold text-xl mb-6 flex items-center gap-2 text-[#35408e]">
                <Sparkles className="w-5 h-5 text-[#d8b638]" />
                What's included:
              </h3>

              <div className="space-y-4">

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#35408e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Unlimited Form Submissions</p>
                    <p className="text-sm text-[#35408e]/70">
                      Create and track as many forms as you need
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#35408e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Electronic Signatures</p>
                    <p className="text-sm text-[#35408e]/70">
                      Legally binding digital signatures
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#35408e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Real-time Collaboration</p>
                    <p className="text-sm text-[#35408e]/70">
                      Work together seamlessly with your team
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#35408e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">AI-Powered Insights</p>
                    <p className="text-sm text-[#35408e]/70">
                      Smart summaries and analytics
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="w-full">

           <Card className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-[#35408e]/10 shadow-2xl rounded-xl">

           {/* GRADIENT BAR (FIXED) */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#35408e] to-[#d8b638]" />

            <CardHeader className="space-y-2 pb-6 pt-6 relative z-10">
                <CardTitle className="text-3xl font-bold text-[#35408e]">
                  Create Account
                </CardTitle>
                <CardDescription>
                  Get started in less than a minute
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">

                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Address *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <Select onValueChange={(value) => updateField('role', value)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Department Head">Department Head</SelectItem>
                        <SelectItem value="Dean">Dean</SelectItem>
                        <SelectItem value="Faculty">Faculty</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Student">Student</SelectItem>
                        <SelectItem value="Finance Officer">Finance Officer</SelectItem>
                        <SelectItem value="Procurement Officer">Procurement Officer</SelectItem>
                        <SelectGroup>
                          <SelectLabel>VP - Departments</SelectLabel>
                          <SelectItem value="VP for Academics">VP for Academics</SelectItem>
                          <SelectItem value="VP for Finance">VP for Finance</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <Select onValueChange={(value) => updateField('department', value)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scs">SCS</SelectItem>
                        <SelectItem value="sabm">SABM</SelectItem>
                        <SelectItem value="sas">SAS</SelectItem>
                      </SelectContent>
                    </Select>

                  </div>

                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Confirm Password *</Label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#35408e] hover:bg-[#2c3577] text-white shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating account...' : (
                      <>
                        <UserPlus className="w-5 h-5 mr-2" />
                        Create Account
                      </>
                    )}
                  </Button>

                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-[#35408e]">
                      Sign in
                    </Link>
                  </p>
                </div>

              </CardContent>

            </Card>

          </div>

        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-10 flex flex-col items-center pb-4">
        <div className="w-90 border-t border-gray-200 shadow-lg" />
        <p className="text-[11px] text-gray-500 mt-2 text-center">
          © {new Date().getFullYear()} SignNU • National University Laguna
        </p>
      </footer>

    </div>
  );
}