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

  addForm: (form: Omit<FormSubmission, 'id' | 'submittedAt' | 'status' | 'currentStep' | 'signatureMarkers'>) => Promise<void>;
  updateForm: (id: string, updates: Partial<FormSubmission>) => Promise<void>;
  getFormById: (id: string) => FormSubmission | undefined;

  approveStep: (formId: string, stepId: string, comments?: string) => Promise<void>;
  rejectStep: (formId: string, stepId: string, comments: string) => Promise<void>;

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

  const authFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.headers || {}),
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

  useEffect(() => {
    const loadNotifications = async () => {
      if (!currentUser) {
        setNotifications([]);
        return;
      }

      try {
        const res = await authFetch(`${API_BASE_URL}/api/users/${currentUser.id}/notifications`);
        if (!res.ok) throw new Error();

        const data = await res.json();
        setNotifications(data);
      } catch {
        setNotifications([]);
      }
    };

    loadNotifications();
  }, [currentUser]);

  /* ===================== LOGIN ===================== */

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) return false;

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
    try {
      await authFetch(`${API_BASE_URL}/api/users/logout`, {
        method: 'POST',
      });
    } catch {
      // ignore logout errors
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  /* ===================== FORMS ===================== */

  const addForm = async (form: any) => {
    const newForm = {
      ...form,
      id: `form-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      currentStep: 0,
      signatureMarkers: [],
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newForm),
      });

      if (!res.ok) {
        throw new Error('Failed to save form');
      }

      const createdForm = await res.json();
      setForms((prev) => [createdForm, ...prev]);
    } catch (error) {
      console.error('Unable to save form:', error);
      setForms((prev) => [newForm, ...prev]);
    }
  };

  const updateForm = async (id: string, updates: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/forms/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error('Failed to update form');
      }

      const updatedForm = await res.json();
      setForms((prev) => prev.map((f) => (f.id === id ? updatedForm : f)));
    } catch (error) {
      console.error('Unable to update form:', error);
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    }
  };

  const getFormById = (id: string) => forms.find((f) => f.id === id);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/forms`);
        if (!res.ok) throw new Error('Failed to load forms');

        const data = await res.json();
        setForms(data);
      } catch (error) {
        console.error('Unable to load forms:', error);
      }
    };

    fetchForms();
  }, []);

  /* ===================== APPROVAL ===================== */

  const approveStep = async (formId: string, stepId: string) => {
    const updatedForms = forms.map((form) => {
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
    });

    setForms(updatedForms);
    updateForm(formId, updatedForms.find((f) => f.id === formId));
  };

  const rejectStep = async (formId: string, stepId: string, comments: string) => {
    const updatedForms = forms.map((form) =>
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
    );

    setForms(updatedForms);
    updateForm(formId, updatedForms.find((f) => f.id === formId));
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

  const addNotification = async (formId: string, userId: string, message: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/users/${userId}/notifications`, {
        method: 'POST',
        body: JSON.stringify({ formId, userId, message }),
      });

      const data = await res.json();
      if (res.ok) {
        if (userId === currentUser?.id) {
          setNotifications((prev) => [data, ...prev]);
        }
      }
    } catch {
      // ignore notification failures silently
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!currentUser) return;

    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/users/${currentUser.id}/notifications/${notificationId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ read: true }),
        }
      );

      if (!res.ok) throw new Error();
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification
        )
      );
    } catch {
      // ignore mark-read failures silently
    }
  };

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