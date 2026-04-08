import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export type FormType = 'ACP' | 'Meal Request' | 'RI' | 'RFP' | 'Item Request';
export type FormStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';
export type UserRole = 'Requester' | 'Signatory' | 'Reviewer' | 'Admin';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Signature {
  id: string;
  userId: string;
  userName: string;
  role: string;
  signedAt: string;
  signature: string;
}

export interface SignatureMarker {
  id: string;
  userId: string;
  userName: string;
  role: string;
  x: number;
  y: number;
  page: number;
}

export interface QRSession {
  id: string;
  formId: string;
  stepId: string;
  token: string;
  expiresAt: string;
  used: boolean;
}

export interface Notification {
  id: string;
  formId: string;
  userId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface ApprovalStep {
  id: string;
  role: string;
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  timestamp?: string;
  isParallel?: boolean; // For parallel approvals
}

export interface FormSubmission {
  id: string;
  type: FormType;
  title: string;
  description: string;
  aiSummary?: string; // AI-generated summary
  submittedBy: string;
  submittedById: string;
  submittedAt: string;
  status: FormStatus;
  formData: Record<string, any>;
  attachments: Attachment[];
  approvalSteps: ApprovalStep[];
  signatures: Signature[];
  signatureMarkers: SignatureMarker[];
  currentStep: number;
  lastNudgedAt?: string;
}

interface WorkflowContextType {
  isAuthenticated: boolean;
  currentUser: { id: string; name: string; role: UserRole; department?: string; email?: string };
  forms: FormSubmission[];
  notifications: Notification[];
  qrSessions: QRSession[];
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { name: string; email: string; password: string; role: string; department: string }) => Promise<boolean>;
  logout: () => void;
  addForm: (form: Omit<FormSubmission, 'id' | 'submittedAt' | 'status' | 'currentStep' | 'signatureMarkers'>) => void;
  updateForm: (id: string, updates: Partial<FormSubmission>) => void;
  getFormById: (id: string) => FormSubmission | undefined;
  approveStep: (formId: string, stepId: string, comments?: string) => void;
  rejectStep: (formId: string, stepId: string, comments: string) => void;
  addSignature: (formId: string, signature: Omit<Signature, 'id' | 'signedAt'>) => void;
  addAttachment: (formId: string, attachment: Omit<Attachment, 'id'>) => void;
  generateQRSession: (formId: string, stepId: string) => QRSession;
  validateQRSession: (token: string) => QRSession | null;
  useQRSession: (token: string, signature: Omit<Signature, 'id' | 'signedAt'>) => boolean;
  addSignatureMarker: (formId: string, marker: Omit<SignatureMarker, 'id'>) => void;
  sendNudge: (formId: string) => void;
  generateAISummary: (formId: string) => Promise<void>;
  addNotification: (formId: string, userId: string, message: string) => void;
  markNotificationRead: (notificationId: string) => void;
  switchUser: (userId: string) => void;
  downloadFormPDF: (formId: string) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      id: 'user-1',
      name: 'Juan Dela Cruz',
      role: 'Admin' as UserRole,
    };
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const viteEnv = import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } };
  const API_BASE_URL = viteEnv.env?.VITE_API_BASE_URL || 'http://localhost:4000';

  const [forms, setForms] = useState<FormSubmission[]>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('workflow-forms');
    if (saved) {
      return JSON.parse(saved);
    }
    return getMockForms();
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('workflow-notifications');
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  });

  // Save forms and notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('workflow-forms', JSON.stringify(forms));
  }, [forms]);

  useEffect(() => {
    localStorage.setItem('workflow-notifications', JSON.stringify(notifications));
  }, [notifications]);
  const [qrSessions, setQrSessions] = useState<QRSession[]>([]);

  const fetchFormsFromBackend = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/forms`);
      if (!response.ok) throw new Error('Failed to load forms from backend');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setForms(data);
      }
    } catch (error) {
      console.error('Could not load forms from backend:', error);
    }
  };

  useEffect(() => {
    fetchFormsFromBackend();
  }, [API_BASE_URL]);

  useEffect(() => {
    const pendingApprovalForms = forms.filter((form) => {
      const currentStep = form.approvalSteps[form.currentStep];
      return (
        form.status === 'pending' &&
        currentStep?.userId === currentUser.id &&
        !notifications.some((notification) => notification.formId === form.id && notification.message.startsWith('New form'))
      );
    });

    if (pendingApprovalForms.length === 0) {
      return;
    }

    const newNotifications = pendingApprovalForms.map((form) => ({
      formId: form.id,
      userId: currentUser.id,
      message: `New form "${form.title}" requires your approval`,
      id: `notif-${Date.now()}-${form.id}`,
      createdAt: new Date().toISOString(),
      read: false,
    }));

    setNotifications((prev) => [...newNotifications, ...prev]);
  }, [forms, currentUser.id, notifications]);

  const createFormOnBackend = async (form: FormSubmission) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error('Failed to create form on backend');
      return await response.json();
    } catch (error) {
      console.error('Create form backend failed', error);
      return null;
    }
  };

  const updateFormOnBackend = async (id: string, updates: Partial<FormSubmission>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/forms/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update form on backend');
      return await response.json();
    } catch (error) {
      console.error('Update form backend failed', error);
      return null;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });

      const data = await response.json();
      if (!response.ok || !data.token || !data.user) {
        return false;
      }

      const role = ['Requester', 'Signatory', 'Reviewer', 'Admin'].includes(data.user.role)
        ? (data.user.role as UserRole)
        : 'Requester';

      const safeUser = {
        id: data.user._id ?? data.user.id,
        name: data.user.username ?? data.user.name ?? data.user.email,
        role,
      };

      setCurrentUser(safeUser);
      setIsAuthenticated(true);
      setAuthToken(data.token);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
      localStorage.setItem('authToken', data.token);

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (data: { name: string; email: string; password: string; role: string; department: string }): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.name,
          email: data.email.toLowerCase().trim(),
          password: data.password,
          role: data.role,
          department: data.department,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.token || !result.user) {
        return false;
      }

      const safeUser = {
        id: result.user._id ?? result.user.id,
        name: result.user.username ?? result.user.name ?? result.user.email,
        role: result.user.role as UserRole,
        department: result.user.department,
        email: result.user.email,
      };

      setCurrentUser(safeUser);
      setIsAuthenticated(true);
      setAuthToken(result.token);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
      localStorage.setItem('authToken', result.token);

      return true;
    } catch (error) {
      console.error('Register error:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser({
      id: 'user-1',
      name: 'Juan Dela Cruz',
      role: 'Admin' as UserRole,
    });
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
  };

  const addForm = (form: Omit<FormSubmission, 'id' | 'submittedAt' | 'status' | 'currentStep' | 'signatureMarkers'>) => {
    const newForm: FormSubmission = {
      ...form,
      id: `form-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      currentStep: 0,
      signatureMarkers: [],
    };

    setForms([newForm, ...forms]);

    createFormOnBackend(newForm).then((savedForm) => {
      if (savedForm) {
        setForms((prevForms) => prevForms.map((f) => f.id === newForm.id ? savedForm : f));
      }
    });

    if (newForm.approvalSteps.length > 0) {
      addNotification(
        newForm.id,
        newForm.approvalSteps[0].userId,
        `New form "${newForm.title}" requires your approval`
      );
    }
  };

  const updateForm = (id: string, updates: Partial<FormSubmission>) => {
    setForms(forms.map(form => form.id === id ? { ...form, ...updates } : form));
    updateFormOnBackend(id, updates).then((savedForm) => {
      if (savedForm) {
        setForms((prevForms) => prevForms.map((form) => form.id === id ? savedForm : form));
      }
    });
  };

  const getFormById = (id: string) => {
    return forms.find(form => form.id === id);
  };

  const approveStep = (formId: string, stepId: string, comments?: string) => {
    const updatedForms: FormSubmission[] = forms.map(form => {
      if (form.id !== formId) return form;
      
      const updatedSteps = form.approvalSteps.map(step => {
        if (step.id === stepId) {
          return {
            ...step,
            status: 'approved' as const,
            comments,
            timestamp: new Date().toISOString(),
          };
        }
        return step;
      });

      const currentStepIndex = updatedSteps.findIndex(s => s.id === stepId);
      const allPreviousApproved = updatedSteps.slice(0, currentStepIndex + 1).every(s => s.status === 'approved');
      const isLastStep = currentStepIndex === updatedSteps.length - 1;

      const nextStep = !isLastStep ? updatedSteps[currentStepIndex + 1] : undefined;
      if (allPreviousApproved && nextStep) {
        addNotification(
          form.id,
          nextStep.userId,
          `Form "${form.title}" is now awaiting your approval`
        );
      }

      return {
        ...form,
        approvalSteps: updatedSteps,
        currentStep: allPreviousApproved && !isLastStep ? currentStepIndex + 1 : form.currentStep,
        status: allPreviousApproved && isLastStep ? 'approved' as FormStatus : form.status,
      };
    });

    setForms(updatedForms);
    const updatedForm = updatedForms.find((form) => form.id === formId);
    if (updatedForm) {
      updateFormOnBackend(formId, {
        approvalSteps: updatedForm.approvalSteps,
        currentStep: updatedForm.currentStep,
        status: updatedForm.status,
      });
    }
  };

  const rejectStep = (formId: string, stepId: string, comments: string) => {
    const updatedForms: FormSubmission[] = forms.map(form => {
      if (form.id !== formId) return form;
      
      const updatedSteps = form.approvalSteps.map(step => {
        if (step.id === stepId) {
          return {
            ...step,
            status: 'rejected' as const,
            comments,
            timestamp: new Date().toISOString(),
          };
        }
        return step;
      });

      addNotification(
        form.id,
        form.submittedById,
        `Your form "${form.title}" was rejected by ${updatedSteps.find(s => s.id === stepId)?.userName}.`
      );

      return {
        ...form,
        approvalSteps: updatedSteps,
        status: 'rejected' as FormStatus,
      };
    });

    setForms(updatedForms);
    const updatedForm = updatedForms.find((form) => form.id === formId);
    if (updatedForm) {
      updateFormOnBackend(formId, {
        approvalSteps: updatedForm.approvalSteps,
        status: updatedForm.status,
      });
    }
  };

  const addSignature = (formId: string, signature: Omit<Signature, 'id' | 'signedAt'>) => {
    const updatedForms = forms.map(form => {
      if (form.id !== formId) return form;
      
      const newSignature: Signature = {
        ...signature,
        id: `sig-${Date.now()}`,
        signedAt: new Date().toISOString(),
      };

      return {
        ...form,
        signatures: [...form.signatures, newSignature],
      };
    });
    setForms(updatedForms);
    const updatedForm = updatedForms.find((form) => form.id === formId);
    if (updatedForm) {
      updateFormOnBackend(formId, {
        signatures: updatedForm.signatures,
      });
    }
  };

  const addAttachment = (formId: string, attachment: Omit<Attachment, 'id'>) => {
    const updatedForms = forms.map(form => {
      if (form.id !== formId) return form;
      
      const newAttachment: Attachment = {
        ...attachment,
        id: `att-${Date.now()}`,
      };

      return {
        ...form,
        attachments: [...form.attachments, newAttachment],
      };
    });
    setForms(updatedForms);
    const updatedForm = updatedForms.find((form) => form.id === formId);
    if (updatedForm) {
      updateFormOnBackend(formId, {
        attachments: updatedForm.attachments,
      });
    }
  };

  const generateQRSession = (formId: string, stepId: string): QRSession => {
    const token = `qr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    
    const session: QRSession = {
      id: `session-${Date.now()}`,
      formId,
      stepId,
      token,
      expiresAt,
      used: false,
    };
    
    setQrSessions([...qrSessions, session]);
    return session;
  };

  const validateQRSession = (token: string): QRSession | null => {
    const session = qrSessions.find(s => s.token === token);
    if (!session) return null;
    
    const now = new Date();
    const expiry = new Date(session.expiresAt);
    
    if (session.used || now > expiry) {
      return null;
    }
    
    return session;
  };

  const useQRSession = (token: string, signature: Omit<Signature, 'id' | 'signedAt'>): boolean => {
    const session = validateQRSession(token);
    if (!session) return false;
    
    // Mark session as used
    setQrSessions(qrSessions.map(s => 
      s.token === token ? { ...s, used: true } : s
    ));
    
    // Add signature
    addSignature(session.formId, signature);
    
    // Auto-approve the step
    approveStep(session.formId, session.stepId, 'Approved via QR signature');
    
    return true;
  };

  const addSignatureMarker = (formId: string, marker: Omit<SignatureMarker, 'id'>) => {
    const updatedForms = forms.map(form => {
      if (form.id !== formId) return form;
      
      const newMarker: SignatureMarker = {
        ...marker,
        id: `marker-${Date.now()}`,
      };

      return {
        ...form,
        signatureMarkers: [...(form.signatureMarkers || []), newMarker],
      };
    });
    setForms(updatedForms);
    const updatedForm = updatedForms.find((form) => form.id === formId);
    if (updatedForm) {
      updateFormOnBackend(formId, {
        signatureMarkers: updatedForm.signatureMarkers,
      });
    }
  };

  const sendNudge = (formId: string) => {
    setForms(forms.map(form => {
      if (form.id !== formId) return form;
      
      const currentStep = form.approvalSteps[form.currentStep];
      if (currentStep) {
        // Create notification for the approver
        addNotification(formId, currentStep.userId, `Reminder: ${form.title} is waiting for your approval`);
      }
      
      return {
        ...form,
        lastNudgedAt: new Date().toISOString(),
      };
    }));
    
    toast.success('Reminder sent to approver');
  };

  const generateAISummary = async (formId: string) => {
    // Mock AI summary generation
    // In production, this would call Gemini 1.5 Flash API
    const form = forms.find(f => f.id === formId);
    if (!form) return;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const summary = `📝 TLDR: ${form.type} request for "${form.title}". ${form.description.substring(0, 100)}... Submitted by ${form.submittedBy}. Currently at step ${form.currentStep + 1}/${form.approvalSteps.length}. ${form.attachments.length} attachments included.`;
    
    setForms(forms.map(f => 
      f.id === formId ? { ...f, aiSummary: summary } : f
    ));
  };

  const addNotification = (formId: string, userId: string, message: string) => {
    const newNotification: Notification = {
      formId,
      userId,
      message,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    setNotifications([newNotification, ...notifications]);
  };

  const markNotificationRead = (notificationId: string) => {
    setNotifications(notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ));
  };

  const switchUser = (userId: string) => {
    const users = [
      { id: 'user-1', name: 'Juan Dela Cruz', role: 'Admin' as UserRole },
      { id: 'user-2', name: 'Maria Santos', role: 'Requester' as UserRole },
      { id: 'user-3', name: 'Robert Garcia', role: 'Signatory' as UserRole },
      { id: 'user-4', name: 'Anna Reyes', role: 'Signatory' as UserRole },
      { id: 'user-5', name: 'Pedro Rodriguez', role: 'Requester' as UserRole },
      { id: 'user-6', name: 'Lisa Chen', role: 'Signatory' as UserRole },
      { id: 'user-7', name: 'Thomas Wilson', role: 'Signatory' as UserRole },
      { id: 'user-8', name: 'Sarah Johnson', role: 'Signatory' as UserRole },
    ];
    
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const downloadFormPDF = (formId: string) => {
    const form = forms.find(f => f.id === formId);
    if (!form) return;
    
    // Check if form is finalized (all signatures collected)
    const allSigned = form.approvalSteps.every(step => step.status === 'approved');
    
    if (!allSigned) {
      toast.error('Cannot download PDF. Form is not yet finalized.');
      return;
    }
    
    // In production, this would use jspdf to generate a flattened PDF
    toast.success('PDF download started (mock implementation)');
  };

  return (
    <WorkflowContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        forms,
        notifications,
        qrSessions,
        login,
        register,
        logout,
        addForm,
        updateForm,
        getFormById,
        approveStep,
        rejectStep,
        addSignature,
        addAttachment,
        generateQRSession,
        validateQRSession,
        useQRSession,
        addSignatureMarker,
        sendNudge,
        generateAISummary,
        addNotification,
        markNotificationRead,
        switchUser,
        downloadFormPDF,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
}

// Mock data for initial state
function getMockForms(): FormSubmission[] {
  return [
    {
      id: 'form-1',
      type: 'ACP',
      title: 'Annual Curriculum Planning - BSIT Program',
      description: 'Curriculum update for Bachelor of Science in Information Technology program for AY 2026-2027',
      submittedBy: 'Maria Santos',
      submittedById: 'user-2',
      submittedAt: '2026-03-28T10:00:00Z',
      status: 'pending',
      formData: {
        department: 'College of Computing',
        program: 'BSIT',
        academicYear: '2026-2027',
        totalUnits: 180,
      },
      attachments: [
        {
          id: 'att-1',
          name: 'Curriculum_Plan_BSIT.pdf',
          size: 2458000,
          type: 'application/pdf',
          url: '#',
        },
      ],
      approvalSteps: [
        {
          id: 'step-1',
          role: 'Department Head',
          userId: 'user-1',
          userName: 'Juan Dela Cruz',
          status: 'pending',
        },
        {
          id: 'step-2',
          role: 'Dean',
          userId: 'user-3',
          userName: 'Robert Garcia',
          status: 'pending',
        },
        {
          id: 'step-3',
          role: 'VP for Academics',
          userId: 'user-4',
          userName: 'Anna Reyes',
          status: 'pending',
        },
      ],
      signatures: [],
      signatureMarkers: [],
      currentStep: 0,
    },
    {
      id: 'form-2',
      type: 'Meal Request',
      title: 'Faculty Development Seminar Catering',
      description: 'Meal request for 50 participants attending the two-day faculty development seminar',
      submittedBy: 'Pedro Rodriguez',
      submittedById: 'user-5',
      submittedAt: '2026-03-29T14:30:00Z',
      status: 'approved',
      formData: {
        eventName: 'Faculty Development Seminar',
        eventDate: '2026-04-05',
        participants: 50,
        mealType: 'Lunch and Snacks',
        budget: 15000,
      },
      attachments: [],
      approvalSteps: [
        {
          id: 'step-4',
          role: 'Department Head',
          userId: 'user-1',
          userName: 'Juan Dela Cruz',
          status: 'approved',
          comments: 'Approved. Budget allocated.',
          timestamp: '2026-03-29T16:00:00Z',
        },
        {
          id: 'step-5',
          role: 'Finance Officer',
          userId: 'user-6',
          userName: 'Lisa Chen',
          status: 'approved',
          comments: 'Budget verified and approved.',
          timestamp: '2026-03-30T09:15:00Z',
        },
      ],
      signatures: [
        {
          id: 'sig-1',
          userId: 'user-1',
          userName: 'Juan Dela Cruz',
          role: 'Department Head',
          signedAt: '2026-03-29T16:00:00Z',
          signature: 'JDC',
        },
      ],
      signatureMarkers: [],
      currentStep: 2,
    },
    {
      id: 'form-3',
      type: 'Item Request',
      title: 'Laboratory Equipment Request - Computer Lab',
      description: 'Request for 10 new desktop computers for the programming laboratory',
      submittedBy: 'Juan Dela Cruz',
      submittedById: 'user-1',
      submittedAt: '2026-03-30T08:00:00Z',
      status: 'pending',
      formData: {
        items: 'Desktop Computer (Intel i7, 16GB RAM) - Quantity: 10, Unit Price: ₱45,000',
        totalAmount: 450000,
        justification: 'Current computers are outdated and unable to run modern development tools',
      },
      attachments: [
        {
          id: 'att-2',
          name: 'Equipment_Specs.pdf',
          size: 890000,
          type: 'application/pdf',
          url: '#',
        },
        {
          id: 'att-3',
          name: 'Price_Quotation.xlsx',
          size: 125000,
          type: 'application/vnd.ms-excel',
          url: '#',
        },
      ],
      approvalSteps: [
        {
          id: 'step-6',
          role: 'Dean',
          userId: 'user-3',
          userName: 'Robert Garcia',
          status: 'pending',
        },
        {
          id: 'step-7',
          role: 'Procurement Officer',
          userId: 'user-7',
          userName: 'Thomas Wilson',
          status: 'pending',
        },
        {
          id: 'step-8',
          role: 'VP for Finance',
          userId: 'user-8',
          userName: 'Sarah Johnson',
          status: 'pending',
        },
      ],
      signatures: [],
      signatureMarkers: [],
      currentStep: 0,
    },
  ];
}