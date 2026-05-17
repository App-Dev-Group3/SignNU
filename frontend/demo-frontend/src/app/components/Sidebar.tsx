import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  FileCheck,
  Pencil,
  LogOut,
  Settings,
  MessageSquare,
  Users,
  X,
  ChevronsLeftRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWorkflow } from '../context/WorkflowContext';
import { Button } from './ui/button';

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useWorkflow();

  useEffect(() => {
    const saved = typeof window !== 'undefined' && window.localStorage.getItem('sidebar_collapsed');
    setCollapsed(saved === 'true');
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('sidebar_collapsed', next ? 'true' : 'false');
      }
      return next;
    });
  };

  if (!currentUser) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    ...(currentUser.role === 'Admin'
      ? []
      : [{ path: '/', icon: LayoutDashboard, label: 'Dashboard' }]),
    { path: '/new-form', icon: FileText, label: 'New Form' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/submissions', icon: FileCheck, label: 'My Submissions' },
    ...(currentUser.role === 'Student' ? [] : [{ path: '/approvals', icon: CheckSquare, label: 'Approval Queue' }]),
    { path: '/account-settings', icon: Settings, label: 'Account Settings' },
    ...(currentUser.role === 'Admin'
      ? [
          { path: '/admin/templates', icon: FileText, label: 'Templates' },
          { path: '/admin', icon: Pencil, label: 'Accounts' },
          { path: '/admin/pending-accounts', icon: Users, label: 'Pending Accounts' },
          { path: '/admin/dashboard', icon: CheckSquare, label: 'Admin Requests' },
        ]
      : []),
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#35408e] flex flex-col text-white shadow-2xl transition-all duration-300 ease-out md:static md:translate-x-0 md:shadow-none ${collapsed ? 'md:w-28' : 'md:w-64'} ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      aria-label="Sidebar navigation"
    >

      {/* HEADER */}
      <div className={`flex items-center gap-3 p-6 border-b border-white/10 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ffd41c] rounded-lg flex items-center justify-center shadow-md">
              <Pencil className="w-6 h-6 text-[#35408e]" />
            </div>

            <div className="flex flex-col items-start md:items-center">
              <span className="font-semibold text-[#ffd41c] text-base">
                SignNU
              </span>
              <p className="text-xs text-white/70">NU Laguna</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={toggleCollapsed}
            variant="ghost"
            className="hidden h-9 px-3 text-white hover:bg-white/10 md:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '>' : '<'}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            className="h-9 w-9 p-0 text-white hover:bg-white/10 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* USER INFO */}
      <div className="p-4 border-b border-white/10">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>

          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-[#ffd41c]">
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>

          <div className={collapsed ? 'hidden' : ''}>
            <p className="text-sm font-medium text-white">
              {currentUser.name}
            </p>
            <p className="text-xs text-white/70">
              {currentUser.role}
            </p>
          </div>

        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">

          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  title={item.label}
                  className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start'} gap-3 ${collapsed ? 'px-0 py-3' : 'px-4 py-3'} rounded-lg transition-all duration-200
                    ${
                      isActive
                        ? 'bg-[#ffd41c] text-[#35408e] font-semibold shadow-md'
                        : 'text-white hover:bg-white/10'
                    }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? 'text-[#35408e]' : 'text-[#ffd41c]'
                    }`}
                  />
                  <span className={`${collapsed ? 'sr-only' : 'text-sm'}`}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}

        </ul>
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-white/10">

        <Button
          onClick={handleLogout}
          className={`w-full flex items-center justify-center bg-[#ffd41c] hover:bg-[#e6c01f] text-[#35408e] font-semibold shadow-md transition-all hover:scale-[1.02] ${collapsed ? 'px-0' : ''}`}
        >
          <LogOut className={`w-4 h-4 ${collapsed ? '' : 'mr-2'}`} />
          {!collapsed && 'Logout'}
        </Button>

        <p className={`text-xs text-white/60 text-center mt-2 ${collapsed ? 'hidden' : ''}`}>
          © 2026 NU Laguna
        </p>

      </div>

    </aside>
  );
}