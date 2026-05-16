import { Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';

export function ApprovalQueue() {
  const { forms, currentUser } = useWorkflow();

  if (!currentUser) {
    return null;
  }

  const currentUserId = String(currentUser.id);
  const currentUserRole = currentUser.role?.toLowerCase() || '';
  const canApprove = currentUserRole !== 'student';

  const pendingApprovals = canApprove
    ? forms.filter(f => 
        f.status === 'pending' && 
        f.approvalSteps.some(step => String(step.userId) === currentUserId && step.status === 'pending')
      )
    : [];

  const approvedByMe = canApprove
    ? forms.filter(f =>
        f.approvalSteps.some(step => 
          String(step.userId) === currentUserId && 
          (step.status === 'approved' || step.status === 'rejected')
        )
      )
    : [];

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Approval Queue</h1>
          <p className="text-gray-600">Review and approve pending forms</p>
        </div>

        {/* Pending Approvals */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Your Approval</CardTitle>
              <Badge variant="secondary">{pendingApprovals.length} pending</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No pending approvals</p>
                <p className="text-sm mt-2">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((form) => (
                  <Link
                    key={form.id}
                    to={`/form/${form.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{form.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{form.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {form.type}
                          </span>
                          <span>•</span>
                          <span>By {form.submittedBy}</span>
                          <span>•</span>
                          <span>{format(new Date(form.submittedAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        <Clock className="w-3 h-3 mr-1" />
                        Awaiting Review
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previously Reviewed */}
        <Card>
          <CardHeader>
            <CardTitle>Previously Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            {approvedByMe.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No forms reviewed yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvedByMe.slice(0, 10).map((form) => {
                  const myStep = form.approvalSteps.find(s => s.userId === currentUser.id);
                  if (!myStep) return null;

                  return (
                    <Link
                      key={form.id}
                      to={`/form/${form.id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{form.title}</h3>
                          <p className="text-sm text-gray-600 mb-2">{form.submittedBy}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>{form.type}</span>
                            <span>•</span>
                            <span>Reviewed {format(new Date(myStep.timestamp!), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                        <Badge
                          variant={myStep.status === 'approved' ? 'default' : 'destructive'}
                        >
                          {myStep.status}
                        </Badge>
                      </div>
                      {myStep.comments && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          "{myStep.comments}"
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
