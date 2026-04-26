import { createBrowserRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { NewForm } from "./pages/NewForm";
import { FormDetails } from "./pages/FormDetails";
import { ApprovalQueue } from "./pages/ApprovalQueue";
import { MySubmissions } from "./pages/MySubmissions";
import { QRSignature } from "./pages/QRSignature";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Admin } from "./pages/Admin";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Root } from "./pages/Root";

// ✅ NEW PAGE IMPORT
import { AccountSettings } from "./pages/AccountSettings";

import DigitalSignatureProfile from "./pages/DigitalSignatureProfile";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "new-form", Component: NewForm },
      { path: "form/:id", Component: FormDetails },
      { path: "approvals", Component: ApprovalQueue },
      { path: "submissions", Component: MySubmissions },

      // ✅ NEW ROUTE ADDED HERE
      { path: "account-settings", Component: AccountSettings },
      { path: "admin", Component: Admin },
      { path: "admin/dashboard", Component: AdminDashboard },
    ],
  },
  {
    path: "/qr/:token",
    Component: QRSignature,
  },
  {
    path: "/DigitalSignatureProfile",
    Component: DigitalSignatureProfile,
  }
]);