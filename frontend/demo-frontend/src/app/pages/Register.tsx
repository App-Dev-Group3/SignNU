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
    
    // Validation
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tl from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:block space-y-8 text-white">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50">
                  <FileCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">SignNU</h1>
                  <p className="text-sm text-purple-200">NU Laguna</p>
                </div>
              </div>
              
              <h2 className="text-5xl font-bold leading-tight">
                Join Our<br />
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Digital Platform
                </span>
              </h2>
              
              <p className="text-xl text-purple-100 leading-relaxed">
                Create your account and experience the future of
                form management and digital signatures.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="font-semibold text-xl mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                What's included:
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Unlimited Form Submissions</p>
                    <p className="text-sm text-purple-200">Create and track as many forms as you need</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Electronic Signatures</p>
                    <p className="text-sm text-purple-200">Legally binding digital signatures</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Real-time Collaboration</p>
                    <p className="text-sm text-purple-200">Work together seamlessly with your team</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">AI-Powered Insights</p>
                    <p className="text-sm text-purple-200">Smart summaries and analytics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Register Form */}
          <div className="w-full">
            <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-xl">
              <CardHeader className="space-y-2 pb-6">
                <div className="lg:hidden flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <FileCheck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">SignNU</h1>
                    <p className="text-sm text-gray-600">NU Laguna</p>
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Create Account
                </CardTitle>
                <CardDescription className="text-base">
                  Get started in less than a minute
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name *</Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Juan Dela Cruz"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        className="pl-12 h-11 border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@nu.edu.ph"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className="pl-12 h-11 border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-medium">Role *</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                        <Select
                          value={formData.role}
                          onValueChange={(value) => updateField('role', value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="pl-12 h-11 border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20">
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
                      <Label htmlFor="department" className="text-sm font-medium">Department *</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10 pointer-events-none" />
                        <Select
                          value={formData.department}
                          onValueChange={(value) => updateField('department', value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="pl-12 h-11 border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scs">SCS</SelectItem>
                            <SelectItem value="sabm">SABM</SelectItem>
                            <SelectItem value="sas">SAS</SelectItem>
                             <SelectItem value='sea'>SEA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password *</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Min. 8 characters"
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        className="pl-12 h-11 border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password *</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Re-enter password"
                        value={formData.confirmPassword}
                        onChange={(e) => updateField('confirmPassword', e.target.value)}
                        className="pl-12 h-11 border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="terms"
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 mt-0.5"
                      required
                    />
                    <label htmlFor="terms" className="text-sm text-gray-600 leading-tight">
                      I agree to the{' '}
                      <button type="button" className="font-medium text-purple-600 hover:text-purple-700 transition-colors">
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button type="button" className="font-medium text-purple-600 hover:text-purple-700 transition-colors">
                        Privacy Policy
                      </button>
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30 transition-all mt-4"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Creating account...
                      </>
                    ) : (
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
                    <Link to="/login" className="font-semibold text-purple-600 hover:text-purple-700 transition-colors">
                      Sign in
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