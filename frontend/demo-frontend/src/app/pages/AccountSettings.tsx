import { useState } from "react";
import { toast } from "sonner";

export function AccountSettings() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = "http://localhost:4000";

  const getToken = () => localStorage.getItem("token");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
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
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "40px auto", padding: "20px" }}>
      <h2 style={{ marginBottom: "20px" }}>Account Settings</h2>

      <form onSubmit={handleChangePassword}>
        {/* OLD PASSWORD */}
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

        {/* NEW PASSWORD */}
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

        {/* BUTTON */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            background: loading ? "#999" : "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          {loading ? "Updating..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}