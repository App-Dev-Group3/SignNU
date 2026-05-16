import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkflow } from "../context/WorkflowContext";

export function AccountSettings() {
  const { currentUser, setCurrentUser } = useWorkflow();
  const [organization, setOrganization] = useState("");
  const [rolesDisplay, setRolesDisplay] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [pendingRoleRequests, setPendingRoleRequests] = useState<Array<{ requestId: string; role: string; status: string; requestedAt: string }>>([]);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);

  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const AUTH_TOKEN_KEY = 'signnu_auth_token';

  useEffect(() => {
    if (!currentUser) return;

    setOrganization(currentUser.organization || '');
    setRolesDisplay((currentUser.roles && currentUser.roles.length > 0)
      ? currentUser.roles.join(', ')
      : currentUser.role || '');

    const fetchRoleData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/roles`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableRoles(Array.isArray(data) ? data.filter((role) => typeof role === 'string') : []);
        }
      } catch (err) {
        console.warn('Failed to load available roles', err);
      }
    };

    const fetchPendingRequests = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/role-requests`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          setPendingRoleRequests(Array.isArray(data)
            ? data.map((request: any) => ({
              requestId: request.id || request.requestId || '',
              role: request.role || '',
              status: request.status || '',
              requestedAt: request.requestedAt ? new Date(request.requestedAt).toLocaleString() : '',
            }))
            : []);
        }
      } catch (err) {
        console.warn('Failed to load pending role requests', err);
      }
    };

    fetchRoleData();
    fetchPendingRequests();
  }, [currentUser]);

  const buildAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("Unable to save profile: no user loaded.");
      return;
    }

    setProfileLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/${currentUser.id}`,
        {
          method: "PATCH",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(),
          },
          body: JSON.stringify({
            organization: organization.trim(),
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to update profile");
        return;
      }

      setCurrentUser({
        ...currentUser,
        organization: data.organization ?? organization.trim(),
      });
      toast.success("Account updated successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update account settings.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleRequestAdditionalRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('Unable to send request: no user loaded.');
      return;
    }
    if (!requestedRole.trim()) {
      toast.error('Please select a role to request.');
      return;
    }

    setRequestLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/${currentUser.id}/role-requests`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...buildAuthHeaders(),
          },
          body: JSON.stringify({ role: requestedRole.trim() }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to submit role request');
        return;
      }

      setPendingRoleRequests((prev) => [
        ...prev,
        {
          requestId: data.request?.id || `request-${Date.now()}`,
          role: data.request?.role || requestedRole.trim(),
          status: data.request?.status || 'pending',
          requestedAt: new Date().toLocaleString(),
        },
      ]);
      setRequestedRole('');
      toast.success('Additional role request submitted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit role request');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/change-password`,
        {
          method: "POST",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(),
          },
          body: JSON.stringify({
            oldPassword,
            newPassword,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.message || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!currentUser?.email) {
      toast.error("No email found for current user.");
      return;
    }

    setPasswordResetLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/test-reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: currentUser.email }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to send password reset test email.");
        return;
      }

      toast.success("Password reset test email sent to your address.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send password reset test email.");
    } finally {
      setPasswordResetLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ maxWidth: "500px", margin: "40px auto", padding: "20px" }}>
        <h2>Account Settings</h2>
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "500px", margin: "40px auto", padding: "20px" }}>
      <h2 style={{ marginBottom: "20px" }}>Account Settings</h2>

      <form onSubmit={handleSaveProfile} style={{ marginBottom: "30px" }}>
        <div style={{ marginBottom: "15px" }}>
          <label>Organization</label>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Student Council, club, or organization"
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>Current Roles</label>
          <div
            style={{
              width: "100%",
              minHeight: "46px",
              marginTop: "5px",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: "#f9fafb",
            }}
          >
            {rolesDisplay || 'No roles assigned'}
          </div>
          <p style={{ marginTop: "8px", fontSize: "12px", color: "#555" }}>
            Your current account roles are shown above. Additional roles must be requested and approved by an administrator.
          </p>
        </div>

        <button
          type="submit"
          disabled={profileLoading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            background: profileLoading ? "#999" : "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {profileLoading ? "Saving profile..." : "Save Account Info"}
        </button>
      </form>

      <form onSubmit={handleRequestAdditionalRole} style={{ marginBottom: "30px", marginTop: "30px" }}>
        <h3 style={{ marginBottom: "12px" }}>Request Additional Role</h3>
        <div style={{ marginBottom: "15px" }}>
          <label>Choose a role to request</label>
          <select
            value={requestedRole}
            onChange={(e) => setRequestedRole(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: "white",
            }}
          >
            <option value="">Select a role</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={requestLoading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            background: requestLoading ? "#999" : "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {requestLoading ? "Requesting role..." : "Request Additional Role"}
        </button>

        {pendingRoleRequests.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h4 style={{ marginBottom: "10px" }}>Pending Role Requests</h4>
            <div style={{ display: "grid", gap: "10px" }}>
              {pendingRoleRequests.map((request) => (
                <div
                  key={request.requestId}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #e5e7eb",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{request.role}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                    Status: {request.status}
                    {' '}• Requested at: {request.requestedAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>

      <form onSubmit={handleChangePassword}>
        <div style={{ marginBottom: "15px" }}>
          <label>Old Password</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={passwordLoading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            background: passwordLoading ? "#999" : "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {passwordLoading ? "Updating..." : "Change Password"}
        </button>
      </form>

      <div style={{ marginTop: "30px" }}>
        <p style={{ marginBottom: "12px", color: "#555" }}>
          Test your password reset email delivery by sending a change-password-style message to your account address.
        </p>
        <button
          type="button"
          onClick={handleSendTestEmail}
          disabled={passwordResetLoading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            background: passwordResetLoading ? "#999" : "#10b981",
            color: "white",
            cursor: "pointer",
          }}
        >
          {passwordResetLoading ? "Sending..." : "Send Test Change Password Email"}
        </button>
      </div>
    </div>
  );
}
