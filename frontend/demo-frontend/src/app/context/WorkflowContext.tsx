import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

/* ===================== TYPES ===================== */

export type FormType = 'ACP' | 'Meal Request' | 'RI' | 'RFP' | 'Item Request';
export type FormStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';

export type UserRole =
  | 'Requester'
  | 'Signatory'
  | 'Reviewer'
  | 'Admin'
  | 'Department Head'
  | 'Dean'
  | 'Faculty'
  | 'Staff'
  | 'Student'
  | 'Finance Officer'
  | 'Procurement Officer'
  | 'VP for Academics'
  | 'VP for Finance';

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

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  department?: string;
  email?: string;
}

export interface ApprovalStep {
  id: string;
  role: string;
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  timestamp?: string;
}

export interface FormSubmission {
  id: string;
  type: FormType;
  title: string;
  description: string;
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
  aiSummary?: string;
}

/* ===================== CONTEXT ===================== */

interface WorkflowContextType {
  isAuthenticated: boolean;
  authLoaded: boolean;
  currentUser: CurrentUser | null;

  forms: FormSubmission[];
  notifications: Notification[];
  qrSessions: QRSession[];

  login: (email: string, password: string) => Promise<boolean>;
  register: (data: any) => Promise<boolean>;
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

  addNotification: (formId: string, userId: string, message: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;

  downloadFormPDF: (formId: string) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

/* ===================== PROVIDER ===================== */

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  const getToken = () => localStorage.getItem('token');

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = getToken();

    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [forms, setForms] = useState<FormSubmission[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [qrSessions, setQrSessions] = useState<QRSession[]>([]);

  /* ===================== SESSION CHECK ===================== */

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/users/me`);
        if (!res.ok) throw new Error();

        const data = await res.json();

        setCurrentUser({
          id: data.user._id ?? data.user.id,
          name: data.user.username ?? data.user.email,
          role: data.user.role,
          email: data.user.email,
          department: data.user.department,
        });

        setIsAuthenticated(true);
      } catch {
        setCurrentUser(null);
        setIsAuthenticated(false);
      } finally {
        setAuthLoaded(true);
      }
    };

    verify();
  }, []);

  /* ===================== LOGIN ===================== */

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) return false;

      localStorage.setItem('token', data.token);

      setCurrentUser({
        id: data.user._id,
        name: data.user.username,
        role: data.user.role,
        email: data.user.email,
      });

      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  };

  /* ===================== LOGOUT ===================== */

  const logout = async () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  /* ===================== FORMS ===================== */

  const addForm = (form: any) => {
    const newForm = {
      ...form,
      id: `form-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      currentStep: 0,
      signatureMarkers: [],
    };

    setForms((prev) => [newForm, ...prev]);
  };

  const updateForm = (id: string, updates: any) => {
    setForms((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const getFormById = (id: string) => forms.find((f) => f.id === id);

  /* ===================== APPROVAL ===================== */

  const approveStep = (formId: string, stepId: string) => {
    setForms((prev) =>
      prev.map((form) => {
        if (form.id !== formId) return form;

        const steps = form.approvalSteps.map((s) =>
          s.id === stepId
            ? {
                ...s,
                status: 'approved' as const,
                timestamp: new Date().toISOString(),
              }
            : s
        );

        return { ...form, approvalSteps: steps };
      })
    );
  };

  const rejectStep = (formId: string, stepId: string, comments: string) => {
    setForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              status: 'rejected' as const,
              approvalSteps: form.approvalSteps.map((s) =>
                s.id === stepId
                  ? {
                      ...s,
                      status: 'rejected' as const,
                      comments,
                    }
                  : s
              ),
            }
          : form
      )
    );
  };

  /* ===================== QR ===================== */

  const generateQRSession = (formId: string, stepId: string): QRSession => {
    const session = {
      id: `s-${Date.now()}`,
      formId,
      stepId,
      token: `t-${Date.now()}`,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      used: false,
    };

    setQrSessions((prev) => [...prev, session]);
    return session;
  };

  const validateQRSession = (token: string) =>
    qrSessions.find((s) => s.token === token) || null;

  const useQRSession = (token: string) => {
    const session = validateQRSession(token);
    if (!session) return false;

    setQrSessions((prev) =>
      prev.map((s) => (s.token === token ? { ...s, used: true } : s))
    );

    return true;
  };

  /* ===================== NOTIFICATIONS ===================== */

  const addNotification = async () => {};
  const markNotificationRead = async () => {};

  /* ===================== OTHER ===================== */

  const addSignature = () => {};
  const addAttachment = () => {};
  const addSignatureMarker = () => {};
  const sendNudge = () => {};
  const generateAISummary = async () => {};
  const downloadFormPDF = () => {};

  return (
    <WorkflowContext.Provider
      value={{
        isAuthenticated,
        authLoaded,
        currentUser,

        forms,
        notifications,
        qrSessions,

        login,
        register: async () => true,
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

        downloadFormPDF,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

/* ===================== HOOK ===================== */

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('useWorkflow must be used within provider');
  return ctx;
}