import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Briefcase, FileCheck, Sparkles, CheckCircle } from 'lucide-react';

export function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    middleInitial: '',
    lastName: '',
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

    // 1. Basic Required Fields Check
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.role || !formData.department) {
      toast.error('Please fill in all required fields');
      return;
    }

    // 2. Strict Name Validation (No numbers allowed)
    const nameRegex = /^[A-Za-z\s\-]+$/;
    if (!nameRegex.test(formData.firstName)) {
      toast.error('First name must contain only letters');
      return;
    }
    if (!nameRegex.test(formData.lastName)) {
      toast.error('Last name must contain only letters');
      return;
    }

    // 3. Middle Initial Validation (Exactly 1 letter, no numbers)
    if (formData.middleInitial) {
      const miRegex = /^[A-Za-z]$/;
      if (!miRegex.test(formData.middleInitial)) {
        toast.error('Middle Initial must be a single letter');
        return;
      }
    }

    // 4. Password Security
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    const result = await register(formData);
    if (result.success) {
      if (result.pending) {
        toast.success('Account created — pending admin approval');
      } else {
        toast.success('Account created successfully!');
        navigate('/');
      }
    } else {
      if (result.pending) {
        toast.error(result.message || 'Email is pending admin approval');
      } else {
        toast.error(result.message || 'Unable to create account. Email may already exist');
      }
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

            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-[#35408e]/10 shadow-lg">
              <h3 className="font-semibold text-xl mb-6 flex items-center gap-2 text-[#35408e]">
                <Sparkles className="w-5 h-5 text-[#d8b638]" />
                What's included:
              </h3>
              <div className="space-y-4">
                {[
                  { title: "Unlimited Form Submissions", desc: "Create and track as many forms as you need" },
                  { title: "Electronic Signatures", desc: "Legally binding digital signatures" },
                  { title: "Real-time Collaboration", desc: "Work together seamlessly with your team" },
                  { title: "AI-Powered Insights", desc: "Smart summaries and analytics" }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-[#35408e] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-[#35408e]/70">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE (FORM) */}
          <div className="w-full">
            <Card className="relative overflow-hidden bg-white/80 backdrop-blur-xl border border-[#35408e]/10 shadow-2xl rounded-xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#35408e] to-[#d8b638]" />
              
              <CardHeader className="space-y-2 pb-6 pt-6 relative z-10">
                <CardTitle className="text-3xl font-bold text-[#35408e]">Request Account</CardTitle>
                <CardDescription>Get started in less than a minute</CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Name Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2 space-y-2">
                      <Label>First Name *</Label>
                      <Input
                        value={formData.firstName}
                        onChange={(e) => updateField('firstName', e.target.value)}
                        placeholder="John"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>MI</Label>
                      <Input
                        value={formData.middleInitial}
                        maxLength={1}
                        onChange={(e) => updateField('middleInitial', e.target.value.toUpperCase())}
                        placeholder="A"
                        className="h-11 text-center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name *</Label>
                      <Input
                        value={formData.lastName}
                        onChange={(e) => updateField('lastName', e.target.value)}
                        placeholder="Doe"
                        className="h-11"
                      />
                    </div>
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
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                        <Select value={formData.role} onValueChange={(v) => updateField('role', v)}>
                          <SelectTrigger className="pl-12 h-11">
                            <SelectValue placeholder="Select role" />
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
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Department *</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                        <Select value={formData.department} onValueChange={(v) => updateField('department', v)}>
                          <SelectTrigger className="pl-12 h-11">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SCS">School of Computer Studies</SelectItem>
                            <SelectItem value="SABM">School of Accountancy and Business Management</SelectItem>
                            <SelectItem value="SAS">School of Arts and Sciences</SelectItem>
                            <SelectItem value="SEA">School of Engineering and Architecture</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#35408e] hover:bg-[#2c3577] text-white shadow-lg mt-2"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating account...' : (
                      <span className="flex items-center">
                        <UserPlus className="w-5 h-5 mr-2" />
                        Request Account
                      </span>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-[#35408e] hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <footer className="mt-10 flex flex-col items-center pb-4">
        <div className="w-90 border-t border-gray-200" />
        <p className="text-[11px] text-gray-500 mt-2 text-center">
          © {new Date().getFullYear()} SignNU • National University Laguna
        </p>
      </footer>
    </div>
  );
}