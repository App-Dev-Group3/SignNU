import { Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

export function MySubmissions() {
  const { forms, currentUser, deleteForm } = useWorkflow();
  const [search, setSearch] = useState('');

  if (!currentUser) {
    return null;
  }
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20';
      case 'rejected':
        return 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20';
    }
  };

  const isAcceptedStatus = (status: string) => status === 'accepted' || status === 'approved';

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'approved':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'draft':
        return 'Draft';
      default:
        return 'Pending';
    }
  };

  const handleDeleteDraft = async (id: string) => {
    const confirmed = window.confirm('Delete this draft? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await deleteForm(id);
      toast.success('Draft deleted successfully');
    } catch (error) {
      console.error('Delete draft failed:', error);
      toast.error('Unable to delete draft');
    }
  };

  const currentUserId = String(currentUser.id);
  const myForms = forms
    .filter(f => String(f.submittedById) === currentUserId)
    .filter(f => {
      const matchesSearch = f.title.toLowerCase().includes(search.toLowerCase()) ||
                           f.description.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        f.status === statusFilter ||
        (statusFilter === 'accepted' && isAcceptedStatus(f.status));
      return matchesSearch && matchesStatus;
    });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">My Submissions</h1>
          <p className="text-gray-600">Track the status of your submitted forms</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search forms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Forms List */}
        {myForms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">No forms found</p>
              <p className="text-gray-400 text-sm mt-2">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Submit your first form to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {myForms.map((form) => (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link to={`/form/${form.id}`} className="font-semibold text-gray-900 hover:text-blue-700">
                          {form.title}
                        </Link>
                        <Badge className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getStatusStyles(form.status)}`}>
                          {getStatusLabel(form.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{form.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {form.type}
                        </span>
                        <span>•</span>
                        <span>Submitted {format(new Date(form.submittedAt), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span>
                          Step {form.currentStep + 1} of {form.approvalSteps.length}
                        </span>
                      </div>
                    </div>

                      <div className="flex flex-wrap items-start gap-2">
                      <Link to={`/form/${form.id}`}>
                        <Button size="sm" className="h-10 bg-[#35408e] text-white shadow-lg shadow-[#35408e]/20 transition-all hover:bg-[#2c3577] hover:scale-[1.02]">
                          View Details
                        </Button>
                      </Link>
                      {form.status === 'draft' && form.submittedById === currentUser.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteDraft(form.id)}
                          className="h-10 whitespace-nowrap bg-[#ef4444] text-white shadow-lg shadow-red-500/20 transition-all hover:bg-[#dc2626] hover:scale-[1.02]"
                        >
                          Delete Draft
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress indicator */}
                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      {form.approvalSteps.map((step, index) => (
                        <div
                          key={step.id}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                            step.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : step.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : index === form.currentStep
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {index + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
