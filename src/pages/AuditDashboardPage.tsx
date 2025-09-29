import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuditStore, type AuditReview } from '../stores/auditStore';
import { useAuthStore } from '../stores/authStore';
import { CheckCircle, XCircle, AlertCircle, Eye, MessageSquare, Download, FileCheck, Users, MapPin, Building } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const COLORS = { compliant: 'hsl(var(--chart-2))', nonCompliant: 'hsl(var(--chart-5))' };

export function AuditDashboardPage() {
  const { 
    reviews, 
    submissions, 
    isLoading, 
    fetchReviews, 
    fetchSubmissions, 
    addReview 
  } = useAuditStore();
  
  const { user } = useAuthStore();
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [additionalComment, setAdditionalComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState<AuditReview['status']>('pending');
  
  // New filters for enhanced functionality
  const [insurerIdFilter, setInsurerIdFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');

  useEffect(() => {
    if (fetchReviews && fetchSubmissions) {
      fetchReviews();
      fetchSubmissions();
    }
  }, [fetchReviews, fetchSubmissions]);

  // Enhanced data processing
  const anonymizedData = useMemo(() => 
    submissions.map(s => ({
      ...s,
      insurerId: `INS-${(s.id.charCodeAt(s.id.length - 1) % 5) + 101}`,
      solvencyRatio: s.capital / s.liabilities
    })), [submissions]);

  const filteredData = useMemo(() => 
    anonymizedData.filter(s => 
      (insurerIdFilter === 'all' || s.insurerId === insurerIdFilter) &&
      (statusFilter === 'all' || s.status === statusFilter)
    ), [anonymizedData, insurerIdFilter, statusFilter]);

  const complianceDistribution = useMemo(() => {
    const compliant = filteredData.filter(s => s.solvencyRatio >= 1).length;
    const nonCompliant = filteredData.length - compliant;
    return [
      { name: 'Compliant', value: compliant },
      { name: 'Non-Compliant', value: nonCompliant }
    ];
  }, [filteredData]);

  const averageSolvencyRatio = useMemo(() => 
    filteredData.length === 0 ? 0 : 
    filteredData.reduce((sum, s) => sum + s.solvencyRatio, 0) / filteredData.length,
    [filteredData]
  );

  const compliancePercentage = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const compliant = filteredData.filter(s => s.solvencyRatio >= 1).length;
    return (compliant / filteredData.length) * 100;
  }, [filteredData]);

  const uniqueInsurerIds = useMemo(() => 
    [...new Set(anonymizedData.map(s => s.insurerId))].sort(),
    [anonymizedData]
  );

  const handleSubmitReview = async () => {
    if (!selectedSubmission || !reviewComment.trim()) {
      toast.error('Please provide a comment for your review');
      return;
    }

    try {
      if (addReview) {
        const fullComment = additionalComment.trim() 
          ? `${reviewComment}\n\nAdditional notes: ${additionalComment}`
          : reviewComment;

        await addReview(selectedSubmission, {
          reviewerId: user?.username || 'unknown',
          reviewerName: user?.businessName || user?.username || 'Unknown Reviewer',
          status: reviewStatus,
          comments: fullComment,
        });
        
        toast.success('Review submitted successfully');
        setSelectedSubmission(null);
        setReviewComment('');
        setAdditionalComment('');
        setReviewStatus('pending');
      }
    } catch (error) {
      toast.error('Failed to submit review');
      console.error('Review submission error:', error);
    }
  };

  const handleOpenDialog = (submissionId: string) => {
    setSelectedSubmission(submissionId);
    setReviewComment('');
    setAdditionalComment('');
    setReviewStatus('pending');
  };

  const handleCloseDialog = () => {
    setSelectedSubmission(null);
    setReviewComment('');
    setAdditionalComment('');
    setReviewStatus('pending');
  };

  const handleExportReport = (format: 'pdf' | 'csv') => {
    // Mock export functionality
    toast.success(`Exporting ${format.toUpperCase()} report...`);
  };

  const getStatusBadge = (status: string, solvencyRatio?: number) => {
    const isCompliant = solvencyRatio ? solvencyRatio >= 1 : status === 'approved';
    const displayStatus = solvencyRatio ? (isCompliant ? 'Compliant' : 'Non-Compliant') : status;
    
    const statusConfig = {
      'Compliant': { variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      'Non-Compliant': { variant: 'destructive' as const, className: 'bg-red-100 text-red-800' },
      pending: { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' },
      under_review: { variant: 'outline' as const, className: 'bg-blue-100 text-blue-800' },
      approved: { variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      rejected: { variant: 'destructive' as const, className: 'bg-red-100 text-red-800' },
      requires_clarification: { variant: 'secondary' as const, className: 'bg-orange-100 text-orange-800' },
    };

    const config = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Badge variant={config.variant} className={config.className}>
        {displayStatus.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'Compliant':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
      case 'Non-Compliant':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'requires_clarification':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive oversight and analysis tools for regulatory compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExportReport('pdf')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={() => handleExportReport('csv')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview & Analytics</TabsTrigger>
          <TabsTrigger value="submissions">Detailed Submissions</TabsTrigger>
          <TabsTrigger value="reviews">Reviews Management</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    Compliance Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[120px]">
                  <p className="text-4xl font-bold text-primary">{compliancePercentage.toFixed(1)}%</p>
                  <p className="text-muted-foreground">of insurers compliant</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Average Solvency Ratio
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[120px]">
                  <p className="text-4xl font-bold text-primary">{averageSolvencyRatio.toFixed(2)}</p>
                  <p className="text-muted-foreground">across all submissions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Total Submissions
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[120px]">
                  <p className="text-4xl font-bold text-primary">{filteredData.length}</p>
                  <p className="text-muted-foreground">in current period</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Distribution</CardTitle>
                  <CardDescription>Breakdown of compliant vs non-compliant insurers</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={complianceDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        <Cell fill={COLORS.compliant} />
                        <Cell fill={COLORS.nonCompliant} />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Solvency Ratio Distribution</CardTitle>
                  <CardDescription>Distribution of solvency ratios across insurers</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={filteredData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="insurerId" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="solvencyRatio" name="Solvency Ratio" fill={COLORS.compliant} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Insurer Submissions</CardTitle>
              <CardDescription>Anonymized financial data submissions with filtering options</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Enhanced Filters */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <Select value={insurerIdFilter} onValueChange={setInsurerIdFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by Insurer ID" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Insurers</SelectItem>
                    {uniqueInsurerIds.map(id => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Compliant">Compliant</SelectItem>
                    <SelectItem value="Non-Compliant">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="last7days">Last 7 days</SelectItem>
                    <SelectItem value="last30days">Last 30 days</SelectItem>
                    <SelectItem value="last90days">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredData && filteredData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insurer ID</TableHead>
                        <TableHead>Submission Date</TableHead>
                        <TableHead>Capital (KES)</TableHead>
                        <TableHead>Liabilities (KES)</TableHead>
                        <TableHead>Solvency Ratio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">
                            {submission.insurerId}
                          </TableCell>
                          <TableCell>
                            {format(new Date(submission.submittedAt), 'PPP')}
                          </TableCell>
                          <TableCell>
                            {submission.capital.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {submission.liabilities.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {submission.solvencyRatio.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(submission.status, submission.solvencyRatio)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDialog(submission.id)}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Review
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileCheck className="mx-auto h-12 w-12 mb-4" />
                  <p>No submissions match your current filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Review Management</CardTitle>
              <CardDescription>
                Manage and track audit reviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviews && reviews.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submission</TableHead>
                      <TableHead>Review Date</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Comments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review) => {
                      const submission = submissions?.find(s => s.id === review.submissionId);
                      const anonymizedId = submission ? `INS-${(submission.id.charCodeAt(submission.id.length - 1) % 5) + 101}` : 'Unknown';
                      return (
                        <TableRow key={review.id}>
                          <TableCell className="font-medium">
                            {anonymizedId}
                          </TableCell>
                          <TableCell>
                            {format(new Date(review.createdAt), 'PPP')}
                          </TableCell>
                          <TableCell>
                            {review.reviewerName}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(review.status)}
                              {getStatusBadge(review.status)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate" title={review.comments}>
                              {review.comments}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="mx-auto h-12 w-12 mb-4" />
                  <p>No reviews submitted yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog - keeping your existing working dialog */}
      {selectedSubmission && (
        <Dialog open={true} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Submit Review</DialogTitle>
              <DialogDescription>
                Provide your review for the selected submission
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Review Status</Label>
                <Select 
                  value={reviewStatus} 
                  onValueChange={(value: AuditReview['status']) => setReviewStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="requires_clarification">Requires Clarification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Comments</Label>
                <Textarea
                  placeholder="Enter your review comments..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Additional Comments (Optional)</Label>
                <Textarea
                  placeholder="Any additional notes or observations..."
                  value={additionalComment}
                  onChange={(e) => setAdditionalComment(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitReview}
                disabled={!reviewComment.trim()}
              >
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}