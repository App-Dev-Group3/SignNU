import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useWorkflow } from "../context/WorkflowContext";

export function AccountSettings() {
  const { currentUser, setCurrentUser } = useWorkflow();
  const [organization, setOrganization] = useState("");
  const [rolesDisplay, setRolesDisplay] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  type RoleRequestOption = { value: string; label: string; departmentId?: string | null; departmentName?: string | null };
  const [availableRoles, setAvailableRoles] = useState<RoleRequestOption[]>([]);
  const [pendingRoleRequests, setPendingRoleRequests] = useState<Array<{ requestId: string; role: string; status: string; requestedAt: string }>>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const AUTH_TOKEN_KEY = 'signnu_auth_token';

  const formatRoleLabel = (role: string, department?: string) => {
    const normalizedRole = role.trim();
    if (normalizedRole === 'Dean' && department?.trim()) {
      return `${normalizedRole} (${department.trim()})`;
    }
    return normalizedRole;
  };

  useEffect(() => {
    if (!currentUser) return;

    setOrganization(currentUser.organization || '');
    setRolesDisplay((currentUser.roles && currentUser.roles.length > 0)
      ? currentUser.roles.map((role) => formatRoleLabel(role, currentUser.department)).join(', ')
      : formatRoleLabel(currentUser.role || '', currentUser.department));

    const fetchRoleData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/roles?detail=true`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        });
        if (!res.ok) {
          return;
        }

        const data = await res.json();
        const roleOptions: Array<{ value: string; label: string; departmentId?: string | null }> = [];

        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'name' in data[0]) {
          const departmentRes = await fetch(`${API_BASE_URL}/api/users/departments`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
          });
          const departmentLookup: Record<string, string> = {};
          if (departmentRes.ok) {
            const departments = await departmentRes.json();
            if (Array.isArray(departments)) {
              departments.forEach((dept: any) => {
                if (dept?.id && dept?.name) {
                  departmentLookup[dept.id] = dept.name;
                }
              });
            }
          }

          (data as any[]).forEach((item) => {
            if (!item?.name) return;
            const roleName = String(item.name).trim();
            const label = item.departmentName
              ? `${roleName} (${item.departmentName.trim()})`
              : roleName;
            roleOptions.push({
              value: label,
              label,
              departmentId: item.departmentId || null,
            });
          });
        } else if (Array.isArray(data)) {
          data.forEach((role) => {
            if (typeof role !== 'string') return;
            const roleName = role.trim();
            if (!roleName) return;
            roleOptions.push({ value: roleName, label: roleName });
          });
        }

        setAvailableRoles(roleOptions);
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
          <p style={{ marginTop: "12px", fontSize: "14px", color: "#333" }}>
            Need to change your password?{' '}
            <Link to="/reset-password" style={{ color: "#2563eb", textDecoration: "underline" }}>
              Go to Reset Password
            </Link>
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
            {availableRoles.map((roleOption) => (
              <option key={roleOption.value} value={roleOption.value}>
                {roleOption.label}
              </option>
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
    </div>
  );
}
