import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkflow } from "../context/WorkflowContext";

export function AccountSettings() {
  const { currentUser, setCurrentUser } = useWorkflow();
  const [organization, setOrganization] = useState("");
  const [rolesInput, setRolesInput] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const AUTH_TOKEN_KEY = 'signnu_auth_token';

  useEffect(() => {
    if (!currentUser) return;

    setOrganization(currentUser.organization || '');
    setRolesInput((currentUser.roles && currentUser.roles.length > 0)
      ? currentUser.roles.join(', ')
      : currentUser.role || '');
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

    const roles = rolesInput
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role.length > 0);

    if (!roles.length) {
      toast.error("Please enter at least one role.");
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
            roles,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to update profile");
        return;
      }

      const updatedUser = {
        ...currentUser,
        organization: data.organization ?? organization.trim(),
        roles,
        role: data.role ?? roles[0],
      };

      setCurrentUser(updatedUser);
      toast.success("Account updated successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update account settings.");
    } finally {
      setProfileLoading(false);
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
          <label>Roles</label>
          <input
            type="text"
            value={rolesInput}
            onChange={(e) => setRolesInput(e.target.value)}
            placeholder="Enter roles separated by commas"
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
          <p style={{ marginTop: "8px", fontSize: "12px", color: "#555" }}>
            Use comma-separated values to add extra roles, e.g. "Student, Student Council".
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
    </div>
  );
}
