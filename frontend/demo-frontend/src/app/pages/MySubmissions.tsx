import { Link } from 'react-router';
import { useWorkflow } from '../context/WorkflowContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

export function MySubmissions() {
  const { forms, currentUser } = useWorkflow();
  const [search, setSearch] = useState('');

  if (!currentUser) {
    return null;
  }
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const myForms = forms
    .filter(f => f.submittedById === currentUser.id)
    .filter(f => {
      const matchesSearch = f.title.toLowerCase().includes(search.toLowerCase()) ||
                           f.description.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
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
              <Link key={form.id} to={`/form/${form.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{form.title}</h3>
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
                      
                      {/* Progress indicator */}
                      <div className="ml-6">
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
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
