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
  signatureURL?: string;
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
  generatedPdfURL?: string;
  currentStep: number;
  lastNudgedAt?: string;
  aiSummary?: string;
}

type AuthResult = {
  success: boolean;
  pending?: boolean;
  message?: string;
};

/* ===================== CONTEXT ===================== */

interface WorkflowContextType {
  isAuthenticated: boolean;
  authLoaded: boolean;
  currentUser: CurrentUser | null;

  forms: FormSubmission[];
  notifications: Notification[];
  qrSessions: QRSession[];

  login: (email: string, password: string) => Promise<AuthResult>;
  register: (data: any) => Promise<AuthResult>;
  logout: () => void;

  addForm: (form: Omit<FormSubmission, 'submittedAt' | 'currentStep' | 'signatureMarkers'>) => Promise<FormSubmission | undefined>;
  updateForm: (id: string, updates: Partial<FormSubmission>) => Promise<void>;
  deleteForm: (id: string) => Promise<void>;
  getFormById: (id: string) => FormSubmission | undefined;

  approveStep: (formId: string, stepId: string, comments?: string) => Promise<void>;
  rejectStep: (formId: string, stepId: string, comments: string) => Promise<void>;

  addSignature: (formId: string, signature: Omit<Signature, 'id' | 'signedAt'>) => void;
  removeSignature: (formId: string, signatureId: string) => void;
  addAttachment: (formId: string, attachment: Omit<Attachment, 'id'>) => void;
  uploadUserPdf: (file: File) => Promise<string>;
  generateFormPdf: (
    formId: string,
    pdfFile: File,
    textFields: Record<string, string>,
    ownerSignature: string | null,
    assignedSignature: string | null,
    annotations?: Array<{
      id: string;
      type: 'text' | 'signature';
      text: string;
      xPct: number;
      yPct: number;
      widthPct: number;
      heightPct: number;
    }>,
    attachmentId?: string,
  ) => Promise<string>;

  generateQRSession: (formId: string, stepId: string) => QRSession;
  validateQRSession: (token: string) => QRSession | null;
  useQRSession: (token: string, signature: Omit<Signature, 'id' | 'signedAt'>) => boolean;

  addSignatureMarker: (formId: string, marker: Omit<SignatureMarker, 'id'>) => void;

  sendNudge: (formId: string) => Promise<void>;

  generateAISummary: (formId: string) => Promise<void>;

  addNotification: (formId: string, userId: string, message: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;

  downloadFormPDF: (formId: string) => void;
  setCurrentUserSignature: (signatureURL: string) => void;
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

  const setCurrentUserSignature = (signatureURL: string) => {
    setCurrentUser((prevUser) =>
      prevUser ? { ...prevUser, signatureURL } : prevUser
    );
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
          signatureURL: data.user.signatureURL ?? data.user.signatureUrl,
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

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          pending: !!data.pending,
          message: data.error || 'Unable to sign in',
        };
      }

      setCurrentUser({
        id: data.user._id,
        name: data.user.username,
        role: data.user.role,
        email: data.user.email,
        signatureURL: data.user.signatureURL ?? data.user.signatureUrl,
      });

      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return { success: false, message: 'Unable to sign in' };
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
      id: form.id ?? `form-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: form.status ?? 'pending',
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
      return createdForm;
    } catch (error) {
      console.error('Unable to save form:', error);
      setForms((prev) => [newForm, ...prev]);
      return newForm;
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
      return updatedForm;
    } catch (error) {
      console.error('Unable to update form:', error);
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
      return undefined;
    }
  };

  const deleteForm = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/forms/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete form');
      }
      setForms((prev) => prev.filter((form) => form.id !== id));
    } catch (error) {
      console.error('Unable to delete form:', error);
      setForms((prev) => prev.filter((form) => form.id !== id));
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
    const form = forms.find((f) => f.id === formId);
    if (!form) return;

    const approvedSteps = form.approvalSteps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            status: 'approved' as const,
            timestamp: new Date().toISOString(),
          }
        : s
    );

    const nextPendingStep = approvedSteps.findIndex((s) => s.status === 'pending');
    const isFinalApproval = nextPendingStep === -1;
    const updatedForm = {
      ...form,
      approvalSteps: approvedSteps,
      currentStep: isFinalApproval ? form.currentStep : nextPendingStep,
      status: isFinalApproval ? 'approved' as const : form.status,
    };

    setForms((prev) => prev.map((f) => (f.id === formId ? updatedForm : f)));
    await updateForm(formId, {
      approvalSteps: approvedSteps,
      currentStep: updatedForm.currentStep,
      status: updatedForm.status,
    });
  };

  const rejectStep = async (formId: string, stepId: string, comments: string) => {
    const form = forms.find((f) => f.id === formId);
    if (!form) return;

    const rejectedSteps = form.approvalSteps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            status: 'rejected' as const,
            comments,
            timestamp: new Date().toISOString(),
          }
        : s
    );

    const updatedForm = {
      ...form,
      approvalSteps: rejectedSteps,
      status: 'rejected' as const,
    };

    setForms((prev) => prev.map((f) => (f.id === formId ? updatedForm : f)));
    await updateForm(formId, {
      approvalSteps: rejectedSteps,
      status: 'rejected' as const,
    });
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

  const uploadUserPdf = async (file: File) => {
    if (!currentUser) {
      throw new Error('User must be authenticated to upload PDF');
    }

    const formData = new FormData();
    formData.append('pdfFile', file);

    const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/pdf`, {
      method: 'PATCH',
      credentials: 'include',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload PDF');
    }

    return data.pdfURL;
  };

  const generateFormPdf = async (
    formId: string,
    pdfFile: File,
    textFields: Record<string, string>,
    ownerSignature: string | null,
    assignedSignature: string | null,
    annotations?: Array<{
      id: string;
      type: 'text' | 'signature';
      text: string;
      xPct: number;
      yPct: number;
      widthPct: number;
      heightPct: number;
    }>,
    attachmentId?: string,
  ) => {
    const formData = new FormData();
    formData.append('pdfFile', pdfFile);
    formData.append('textFields', JSON.stringify(textFields));
    if (ownerSignature) {
      formData.append('ownerSignature', ownerSignature);
    }
    if (assignedSignature) {
      formData.append('assignedSignature', assignedSignature);
    }
    if (annotations) {
      formData.append('annotations', JSON.stringify(annotations));
    }
    if (attachmentId) {
      formData.append('attachmentId', attachmentId);
    }

    const res = await fetch(`${API_BASE_URL}/api/forms/${formId}/pdf`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate PDF');
    }
    return data.pdfURL;
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

  const addSignature = (formId: string, signature: Omit<Signature, 'id' | 'signedAt'>) => {
    setForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              signatures: [
                ...form.signatures,
                {
                  id: `sig-${Date.now()}`,
                  signedAt: new Date().toISOString(),
                  ...signature,
                },
              ],
            }
          : form
      )
    );
  };

  const removeSignature = (formId: string, signatureId: string) => {
    setForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              signatures: form.signatures.filter((sig) => sig.id !== signatureId),
            }
          : form
      )
    );
  };

  const addAttachment = (formId: string, attachment: Omit<Attachment, 'id'>) => {
    setForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              attachments: [
                ...form.attachments,
                {
                  id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                  ...attachment,
                },
              ],
            }
          : form
      )
    );
  };

  const addSignatureMarker = (formId: string, marker: Omit<SignatureMarker, 'id'>) => {
    setForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              signatureMarkers: [
                ...form.signatureMarkers,
                {
                  id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                  ...marker,
                },
              ],
            }
          : form
      )
    );
  };

  const sendNudge = async (formId: string) => {
    const form = forms.find((f) => f.id === formId);
    if (!form || !currentUser) return;

    if (form.submittedById !== currentUser.id && currentUser.role !== 'Admin') {
      toast.error('Only the request owner or an admin can send a nudge');
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/api/forms/${formId}/nudge`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Send nudge failed:', data);
        toast.error(data.error || 'Unable to send nudge');
        return;
      }

      if (data.form) {
        setForms((prev) =>
          prev.map((f) => (f.id === formId ? { ...f, ...data.form } : f))
        );
      } else {
        setForms((prev) =>
          prev.map((f) =>
            f.id === formId
              ? {
                  ...f,
                  lastNudgedAt: new Date().toISOString(),
                }
              : f
          )
        );
      }

      toast.success(data.message || 'Nudge sent to pending approvers');
    } catch (error) {
      console.error('Nudge failed:', error);
      toast.error('Unable to send nudge');
    }
  };

  const generateAISummary = async (formId: string) => {
    const form = forms.find((f) => f.id === formId);
    if (!form) return;
    setForms((prev) =>
      prev.map((f) =>
        f.id === formId
          ? {
              ...f,
              aiSummary: `This form titled "${form.title}" is a ${form.type} request with ${form.approvalSteps.length} required approvals.`,
            }
          : f
      )
    );
  };

  const downloadFormPDF = (formId: string) => {
    const form = forms.find((f) => f.id === formId);
    if (!form) return;
    // default behavior remains unchanged
  };

  const register = async (data: {
    firstName: string;
    middleInitial?: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
    department: string;
  }): Promise<AuthResult> => {
    try {
      const fullName = [data.firstName, data.lastName, data.middleInitial]
        .filter((part) => part && part.trim().length > 0)
        .join(' ');

      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.firstName,
          middleInitial: data.middleInitial,
          lastName: data.lastName,
          username: fullName,
          email: data.email.toLowerCase().trim(),
          password: data.password,
          role: data.role,
          department: data.department,
        }),
      });

      const responseData = await res.json();
      if (!res.ok) {
        console.error('Register failed:', responseData);
        return {
          success: false,
          pending: !!responseData.pending,
          message: responseData.error || 'Unable to create account',
        };
      }

      if (responseData.pending) {
        return {
          success: true,
          pending: true,
          message: responseData.message || 'Account request submitted and pending admin approval',
        };
      }

      if (!responseData.user) {
        return {
          success: false,
          message: 'Unable to create account',
        };
      }

      // If server issued token (auto-approved user), persist session state in client.
      if (responseData.token) {
        setCurrentUser({
          id: responseData.user._id ?? responseData.user.id,
          name: responseData.user.username ?? responseData.user.email,
          role: responseData.user.role,
          email: responseData.user.email,
          signatureURL: responseData.user.signatureURL ?? responseData.user.signatureUrl,
        });
        setIsAuthenticated(true);
        return { success: true };
      }

      // Fallback for non-token success responses.
      return { success: true, pending: !!responseData.pending };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: 'Unable to create account' };
    }
  };

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
        register,
        logout,

        addForm,
        updateForm,
        getFormById,

        approveStep,
        rejectStep,

        addSignature,
        removeSignature,
        addAttachment,
        uploadUserPdf,
        generateFormPdf,
        deleteForm,

        generateQRSession,
        validateQRSession,
        useQRSession,

        addSignatureMarker,
        sendNudge,
        generateAISummary,

        addNotification,
        markNotificationRead,

        downloadFormPDF,
        setCurrentUserSignature,
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