import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useWorkflow, FormType } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Upload, X } from 'lucide-react';

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
  const { addForm, currentUser } = useWorkflow();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  if (!currentUser) {
    return null;
  }

  const [formType, setFormType] = useState<FormType | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string }>>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [approvalSteps, setApprovalSteps] = useState<Array<{ role: string; userId: string; userName: string }>>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users`);
        if (!response.ok) {
          throw new Error('Failed to load users');
        }
        const fetchedUsers = await response.json();
        setAvailableUsers(fetchedUsers.map((user: any) => ({
          id: user._id || user.id,
          name: user.username || user.name || user.email,
          role: user.role,
        })));
      } catch (error) {
        console.error('Error loading approvers:', error);
      }
    };

    fetchUsers();
  }, [API_BASE_URL]);

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formType || !title || !description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (approvalSteps.some((step) => !step.userId)) {
      toast.error('Please select an approver for every approval step');
      return;
    }

    addForm({
      type: formType,
      title,
      description,
      submittedBy: currentUser.name,
      submittedById: currentUser.id,
      formData,
      attachments: attachments.map((att, index) => ({
        ...att,
        id: `att-${Date.now()}-${index}`,
        url: '#',
      })),
      approvalSteps: approvalSteps.map((step, index) => ({
        id: `step-${Date.now()}-${index}`,
        ...step,
        status: 'pending' as const,
      })),
      signatures: [],
    });

    toast.success('Form submitted successfully!');
    navigate('/submissions');
  };

  const getApproverOptions = (role: string) => {
    return availableUsers.filter((user) => user.role === role);
  };

  const buildApprovalSteps = (type: FormType) => {
    return approvalChains[type].map((step) => {
      const matchedUser = availableUsers.find((user) => user.role === step.role);
      return {
        role: step.role,
        userId: matchedUser?.id || '',
        userName: matchedUser?.name || '',
      };
    });
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

  useEffect(() => {
    if (!formType) {
      setApprovalSteps([]);
      return;
    }

    setApprovalSteps(buildApprovalSteps(formType));
  }, [formType, availableUsers]);

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

              {/* Attachments */}
              <div className="space-y-2">
                <Label htmlFor="attachments">Attachments</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    PDF, DOC, XLSX up to 10MB
                  </p>
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('attachments')?.click()}
                  >
                    Select Files
                  </Button>
                </div>

                {/* Attachment List */}
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approval Chain Preview */}
              {formType && (
                <div className="space-y-2">
                  <Label>Approval Chain</Label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Select an approver account for each approval role below.
                    </p>
                    <div className="space-y-4">
                      {approvalSteps.map((step, index) => (
                        <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr] items-center text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{step.role}</div>
                              <div className="text-gray-500 text-xs">Choose a user for this role</div>
                            </div>
                          </div>
                          <Select value={step.userId} onValueChange={(value) => handleApproverChange(index, value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select approver" />
                            </SelectTrigger>
                            <SelectContent>
                              {getApproverOptions(step.role).map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {getApproverOptions(step.role).length === 0 && (
                            <p className="text-xs text-orange-600 col-span-full">
                              No users with the role "{step.role}" were found. Create a user with that role or choose a different role in the backend.
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
          <div className="mt-6 flex gap-4">
            <Button type="submit" size="lg">
              Submit Form
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate('/')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
