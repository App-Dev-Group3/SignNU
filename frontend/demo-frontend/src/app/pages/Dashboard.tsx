import { Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { FileText, CheckCircle, Clock, AlertCircle, TrendingUp, Plus, Bell } from 'lucide-react';
import { format } from 'date-fns';

export function Dashboard() {
  const { forms, currentUser, notifications, markNotificationRead } = useWorkflow();

  if (!currentUser) {
    return null;
  }

  const mySubmissions = forms.filter(f => f.submittedById === currentUser.id);
  const myNotifications = notifications.filter(n => n.userId === currentUser.id);
  const unreadCount = myNotifications.filter(n => !n.read).length;
  const pendingApprovals = forms.filter(f => 
    f.status === 'pending' && 
    f.approvalSteps[f.currentStep]?.userId === currentUser.id
  );

  const stats = [
    {
      title: 'Total Submissions',
      value: mySubmissions.length,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Pending Approvals',
      value: pendingApprovals.length,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Approved',
      value: mySubmissions.filter(f => f.status === 'approved').length,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Rejected',
      value: mySubmissions.filter(f => f.status === 'rejected').length,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  const recentForms = [...forms]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {currentUser.name}</p>
        </div>

        {/* Quick Action */}
        <div className="mb-8">
          <Link to="/new-form">
            <Button size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              Submit New Form
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                      <p className="text-3xl font-semibold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-600" />
                  <div>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Web approval alerts</CardDescription>
                  </div>
                </div>
                <Badge variant={unreadCount > 0 ? 'secondary' : 'default'}>
                  {unreadCount} unread
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {myNotifications.length === 0 ? (
                <p className="text-sm text-gray-500">No notifications yet.</p>
              ) : (
                <div className="space-y-3">
                  {myNotifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border ${notification.read ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-800">{notification.message}</p>
                        {!notification.read && (
                          <Badge variant="default">New</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{new Date(notification.createdAt).toLocaleString()}</p>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markNotificationRead(notification.id)}
                          className="mt-2"
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Forms */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Forms</CardTitle>
              <CardDescription>Latest form submissions in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentForms.map((form) => (
                  <Link
                    key={form.id}
                    to={`/form/${form.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-1">{form.title}</p>
                        <p className="text-sm text-gray-600">{form.submittedBy}</p>
                      </div>
                      <Badge
                        variant={
                          form.status === 'approved'
                            ? 'default'
                            : form.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {form.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{form.type}</span>
                      <span>•</span>
                      <span>{format(new Date(form.submittedAt), 'MMM d, yyyy')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Your Approval</CardTitle>
              <CardDescription>Forms waiting for your review</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map((form) => (
                    <Link
                      key={form.id}
                      to={`/form/${form.id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">{form.title}</p>
                          <p className="text-sm text-gray-600">{form.submittedBy}</p>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{form.type}</span>
                        <span>•</span>
                        <span>{format(new Date(form.submittedAt), 'MMM d, yyyy')}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
