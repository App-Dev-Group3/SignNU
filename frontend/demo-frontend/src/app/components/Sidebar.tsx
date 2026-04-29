import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  FileCheck,
  School,
  LogOut,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { Button } from './ui/button';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useWorkflow();

  if (!currentUser) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    ...(currentUser.role === 'Admin' ? [] : [{ path: '/', icon: LayoutDashboard, label: 'Dashboard' }]),
    { path: '/new-form', icon: FileText, label: 'New Form' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/submissions', icon: FileCheck, label: 'My Submissions' },
    { path: '/approvals', icon: CheckSquare, label: 'Approval Queue' },
    { path: '/account-settings', icon: Settings, label: 'Account Settings' },
    ...(currentUser.role === 'Admin'
      ? [
          { path: '/admin', icon: School, label: 'Accounts' },
          { path: '/admin/dashboard', icon: CheckSquare, label: 'Admin Requests' },
        ]
      : []),
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <School className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">SignNU</h1>
            <p className="text-sm text-gray-500">NU Laguna</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="text-xs text-gray-500">{currentUser.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <Button className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
        <p className="text-xs text-gray-500 text-center mt-2">
          © 2026 NU Laguna
        </p>
      </div>
    </div>
  );
}