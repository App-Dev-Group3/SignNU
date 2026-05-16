import { useState } from 'react';
import { Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { FileText, CheckCircle, Clock, AlertCircle, Plus, Bell, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AIAssistant from '../components/ui/AIAssistant';

export function Dashboard() {
  const { forms, currentUser, notifications, markNotificationRead, dismissNotification, deleteForm } = useWorkflow();
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);

  if (!currentUser) return null;

  const mySubmissions = forms.filter(f => f.submittedById === currentUser.id);
  const myNotifications = notifications.filter(n => n.userId === currentUser.id);
  const unreadCount = myNotifications.filter(n => !n.read).length;

  const hasApprovalAccess = currentUser.role !== 'Student';

  const pendingApprovals = hasApprovalAccess
    ? forms.filter(f =>
        f.status === 'pending' &&
        f.approvalSteps.some(step => step.userId === currentUser.id && step.status === 'pending')
      )
    : [];

  const pendingSubmissions = mySubmissions.filter(f => f.status === 'pending').length;
  const approvedByMe = forms.filter(f => f.approvalSteps.some(step => step.userId === currentUser.id && step.status === 'approved')).length;
  const rejectedByMe = forms.filter(f => f.approvalSteps.some(step => step.userId === currentUser.id && step.status === 'rejected')).length;
  const myApproved = mySubmissions.filter(f => f.status === 'approved' || f.status === 'accepted').length;
  const myRejected = mySubmissions.filter(f => f.status === 'rejected').length;
  const showRequestStats = mySubmissions.length > 0;

  const stats = [
    { title: 'Total Submissions', value: mySubmissions.length, icon: FileText, color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10' },
    { title: 'Pending Requests', value: pendingSubmissions, icon: Clock, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
    { title: 'Pending Approvals', value: pendingApprovals.length, icon: Bell, color: 'text-[#EAB308]', bg: 'bg-[#EAB308]/10' },
    { title: 'Approved', value: showRequestStats ? myApproved : approvedByMe, icon: CheckCircle, color: 'text-[#22C55E]', bg: 'bg-[#22C55E]/10' },
    { title: 'Rejected', value: showRequestStats ? myRejected : rejectedByMe, icon: AlertCircle, color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10' },
  ];

  const visibleForms = forms.filter(form =>
    form.status !== 'draft' ||
    form.submittedById === currentUser.id
  );

  const recentForms = [...visibleForms]
    .filter(form =>
      currentUser.role === 'Admin' ||
      form.submittedById === currentUser.id ||
      form.approvalSteps.some(step => step.userId === currentUser.id)
    )
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50">

      {/* FULL WIDTH OVERVIEW BAR (SMALL GLASS) */}
        <div className="w-full bg-white/30 backdrop-blur-xl border-b border-white/40 shadow-sm">

          <div className="max-w-7xl mx-auto px-8 py-3 flex items-end justify-between">

            <div>
              <p className="text-[10px] font-medium text-[#35408e]/60 uppercase tracking-wider">
                Dashboard
              </p>

              <h1 className="text-lg font-semibold text-[#35408e] mt-0.5 leading-tight">
                Good day, {currentUser.name}
              </h1>

              <p className="text-[10px] text-[#35408e]/60 mt-0.5 leading-tight">
                {unreadCount > 0
                  ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : "Everything is up to date"}
              </p>
            </div>

          </div>
        </div>

      {/* PAGE CONTENT (CENTERED) */}
      <div className="max-w-7xl mx-auto px-8 py-6">

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-4 mb-10">
          <Link to="/new-form">
            <Button className="gap-2 h-11 bg-[#35408e] hover:bg-[#2c3577] shadow-lg shadow-[#35408e]/20 transition-all hover:scale-[1.02]">
              <Plus className="w-5 h-5" />
              Submit Form
            </Button>
          </Link>

          <Link to="/DigitalSignatureProfile">
            <Button variant="outline" className="gap-2 h-11 bg-[#ffd41c] text-white hover:text-white hover:bg-[#ffd41c] shadow-lg shadow-[#35408e]/20 transition-all hover:scale-[1.02]">
              Modify Signature
            </Button>
          </Link>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="bg-white/90 border border-gray-200 shadow-sm rounded-xl">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.title}</p>
                      <p className="text-3xl font-bold text-[#35408e]">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* NOTIFICATIONS */}
          <Card className="relative overflow-hidden bg-[#ffd41c]/20 border border-[#d8b638]/40 shadow-md rounded-xl">

            <div className="h-1.5 w-full bg-gradient-to-r from-[#35408e] to-[#d8b638]" />

            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#35408e]" />
                  <div>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Approval alerts</CardDescription>
                  </div>
                </div>

                <Badge className="bg-[#35408e]/10 text-[#35408e]">
                  {unreadCount} unread
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {myNotifications.length === 0 ? (
                <p className="text-sm text-gray-500">No notifications yet.</p>
              ) : notificationsExpanded ? (
                <>
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {myNotifications.map(n => {
                      const isApproved = n.message.toLowerCase().includes('approved');
                      const isRejected = n.message.toLowerCase().includes('rejected');
                      return (
                        <div key={n.id} className={`p-3 rounded-lg flex items-start justify-between gap-3 ${
                          isApproved ? 'bg-green-50 border border-green-200' :
                          isRejected ? 'bg-red-50 border border-red-200' :
                          'bg-[#35408e]/5 border border-[#35408e]/10'
                        }`}>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${
                              isApproved ? 'text-green-900' :
                              isRejected ? 'text-red-900' :
                              'text-gray-900'
                            }`}>{n.message}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => dismissNotification(n.id)}
                            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Dismiss notification"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    onClick={() => setNotificationsExpanded(false)}
                    variant="outline"
                    className="w-full h-10"
                  >
                    Show less
                  </Button>
                </>
              ) : (
                myNotifications.slice(0, 1).map(n => (
                  <div key={n.id} className={`p-3 rounded-lg flex items-start justify-between gap-3 ${
                    n.message.toLowerCase().includes('approved') ? 'bg-green-50 border border-green-200' :
                    n.message.toLowerCase().includes('rejected') ? 'bg-red-50 border border-red-200' :
                    'bg-[#35408e]/5 border border-[#35408e]/10'
                  }`}>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        n.message.toLowerCase().includes('approved') ? 'text-green-900' :
                        n.message.toLowerCase().includes('rejected') ? 'text-red-900' :
                        'text-gray-900'
                      }`}>{n.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissNotification(n.id)}
                      className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Dismiss notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}

              {!notificationsExpanded && myNotifications.length > 0 && (
                <Button
                  onClick={() => setNotificationsExpanded(true)}
                  className="mt-4 w-full h-11 bg-[#35408e] hover:bg-[#2c3577] text-white shadow-lg shadow-[#35408e]/30 transition-all hover:scale-[1.02]"
                >
                  View all
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RECENT + APPROVALS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* RECENT FORMS */}
          <Card className="bg-white/80 backdrop-blur-xl border border-[#35408e]/10 shadow-xl rounded-xl">
            <CardHeader>
              <CardTitle className="text-[#35408e]">Recent Forms</CardTitle>
              <CardDescription>Latest activity</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {recentForms.map(form => (
                <div key={form.id} className="p-4 rounded-lg border border-[#35408e]/10 hover:bg-[#35408e]/5 transition">
                  <div className="flex justify-between mb-2">
                    <Link to={`/form/${form.id}`} className="font-medium text-[#35408e] hover:underline">
                      {form.title}
                    </Link>

                    <Badge className="bg-[#35408e]/10 text-[#35408e]">
                      {form.status}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600">{form.submittedBy}</p>

                  <div className="flex justify-between mt-3 text-xs text-gray-500">
                    <span>{form.type}</span>
                    <span>{format(new Date(form.submittedAt), 'MMM d')}</span>
                  </div>
                 {/* ✅ RESTORED VIEW DETAILS */}
                  <div className="mt-3 flex justify-end">
                    <Link to={`/form/${form.id}`}>
                      <Button
                        size="sm"
                        className="bg-[#35408e] hover:bg-[#2c3577] text-white transition-all hover:scale-[1.02]"
                      >
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {hasApprovalAccess && (
            <Card className="bg-white/80 backdrop-blur-xl border border-[#35408e]/10 shadow-xl rounded-xl">
              <CardHeader>
                <CardTitle className="text-[#35408e]">Pending Approval</CardTitle>
                <CardDescription>Needs your action</CardDescription>
              </CardHeader>

              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    No pending approvals
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingApprovals.map(form => (
                      <Link key={form.id} to={`/form/${form.id}`} className="block p-4 rounded-lg border border-[#35408e]/10 hover:bg-[#35408e]/5 transition">
                        <p className="font-medium text-[#35408e]">{form.title}</p>
                        <p className="text-sm text-gray-600">{form.submittedBy}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

      </div>

      <AIAssistant />
    </div>
  );
}