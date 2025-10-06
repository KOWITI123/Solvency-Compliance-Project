import { useEffect, useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuditStore, type AuditReview } from '../stores/auditStore';
import { useAuthStore } from '../stores/authStore';
import { CheckCircle, XCircle, AlertCircle, Eye, MessageSquare, Download, FileCheck, Users, MapPin, Building, Bell, Clock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FaCheck, FaTimes, FaFileAlt, FaUser } from 'react-icons/fa';

const COLORS = { compliant: 'hsl(var(--chart-2))', nonCompliant: 'hsl(var(--chart-5))' };

// Add new interfaces for regulator functionality
interface PendingSubmission {
  id: number;
  data_hash: string;
  capital: number;
  liabilities: number;
  solvency_ratio: number;
  submission_date: string;
  insurer_submitted_at: string;
  insurer?: {
    id: number;
    username: string;
    email: string;
  };
  status: string;
}

interface RegulatorNotification {
  id: number;
  message: string;
  urgency: string;
  sent_at: string;
  sender?: {
    username: string;
  };
}

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
  
  // New state for regulator approval functionality
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [regulatorNotifications, setRegulatorNotifications] = useState<RegulatorNotification[]>([]);
  const [selectedPendingSubmission, setSelectedPendingSubmission] = useState<PendingSubmission | null>(null);
  const [approvalComments, setApprovalComments] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  
  // Existing filters
  const [insurerIdFilter, setInsurerIdFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');

  // New functions for regulator approval workflow
  const fetchPendingSubmissions = async () => {
    try {
      console.log('📋 Fetching pending submissions for audit...');
      
      const response = await fetch('http://localhost:5000/api/regulator/pending-submissions');
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Pending submissions data:', data);
        setPendingSubmissions(data.submissions || []);
      } else {
        console.error('Failed to fetch pending submissions:', response.status);
        setPendingSubmissions([]);
      }
    } catch (error) {
      console.error('Error fetching pending submissions:', error);
      setPendingSubmissions([]);
    }
  };

  const fetchRegulatorNotifications = useCallback(async () => {
    try {
      console.log('📬 Fetching regulator notifications...');
      
      const response = await fetch('http://localhost:5000/api/notifications/regulator/reg-1');
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Notifications data:', data);
        setRegulatorNotifications(data.notifications || []);
      } else {
        console.error('Failed to fetch notifications:', response.status);
        setRegulatorNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching regulator notifications:', error);
      setRegulatorNotifications([]);
    }
  }, []);

  const approveSubmission = async () => {
    if (!selectedPendingSubmission) return;
    
    setIsApproving(true);
    try {
      const response = await fetch('http://localhost:5000/api/regulator/approve-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: selectedPendingSubmission.id,
          comments: approvalComments || 'Approved by regulator'
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Submission Approved!', {
          description: `Data hash ${selectedPendingSubmission.data_hash.substring(0, 8)}... has been approved.`
        });
        
        fetchPendingSubmissions();
        fetchRegulatorNotifications();
        setSelectedPendingSubmission(null);
        setApprovalComments('');
      } else {
        toast.error('Approval Failed', {
          description: data.error || 'Failed to approve submission'
        });
      }
    } catch (error) {
      toast.error('Network Error', {
        description: 'Could not connect to server'
      });
    } finally {
      setIsApproving(false);
    }
  };

  const rejectSubmission = async () => {
    if (!selectedPendingSubmission) return;
    
    setIsRejecting(true);
    try {
      const response = await fetch('http://localhost:5000/api/regulator/reject-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: selectedPendingSubmission.id,
          comments: approvalComments || 'Submission rejected by regulator'
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Submission Rejected', {
          description: `Data hash ${selectedPendingSubmission.data_hash.substring(0, 8)}... has been rejected.`
        });
        
        fetchPendingSubmissions();
        fetchRegulatorNotifications();
        setSelectedPendingSubmission(null);
        setApprovalComments('');
      } else {
        toast.error('Rejection Failed', {
          description: data.error || 'Failed to reject submission'
        });
      }
    } catch (error) {
      toast.error('Network Error', {
        description: 'Could not connect to server'
      });
    } finally {
      setIsRejecting(false);
    }
  };

  useEffect(() => {
    if (fetchReviews && fetchSubmissions) {
      fetchReviews();
      fetchSubmissions();
    }
    
    // Fetch new regulator data
    fetchPendingSubmissions();
    fetchRegulatorNotifications();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchPendingSubmissions();
      fetchRegulatorNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchReviews, fetchSubmissions, fetchRegulatorNotifications, user]);

  // Enhanced data processing
  const anonymizedData = useMemo(() => 
    submissions ? submissions.map(s => ({
      ...s,
      insurerId: `INS-${(s.id.charCodeAt(s.id.length - 1) % 5) + 101}`,
      solvencyRatio: s.capital / s.liabilities
    })) : [], [submissions]);

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
      'INSURER_SUBMITTED': { variant: 'outline' as const, className: 'bg-blue-100 text-blue-800' },
      'REGULATOR_APPROVED': { variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      'REJECTED': { variant: 'destructive' as const, className: 'bg-red-100 text-red-800' },
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
      case 'REGULATOR_APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
      case 'Non-Compliant':
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'requires_clarification':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'INSURER_SUBMITTED':
        return <Clock className="h-4 w-4 text-blue-600" />;
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
          <h1 className="text-3xl font-bold tracking-tight">Regulatory Audit Dashboard</h1>
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

      {/* NEW: Notifications Banner - ✅ ULTRA SAFE VERSION */}
      {Array.isArray(regulatorNotifications) && regulatorNotifications.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Bell className="h-5 w-5" />
              Active Notifications
              <Badge variant="secondary">{regulatorNotifications.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {regulatorNotifications.slice(0, 3).map((notification, index) => {
                // ✅ COMPLETELY SAFE WITH MULTIPLE FALLBACKS
                if (!notification) return null;
                
                const notificationId = notification.id || `notification-${index}`;
                const notificationMessage = notification.message || 'No message available';
                const notificationUrgency = notification.urgency || 'Medium';
                const senderUsername = (notification.sender && notification.sender.username) || 'System';
                
                return (
                  <div key={notificationId} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notificationMessage}</p>
                      <p className="text-xs text-muted-foreground">
                        From: {senderUsername}
                      </p>
                    </div>
                    <Badge variant={notificationUrgency === 'High' ? 'destructive' : 'secondary'}>
                      {notificationUrgency}
                    </Badge>
                  </div>
                );
              }).filter(Boolean)}
              {regulatorNotifications.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{regulatorNotifications.length - 3} more notifications...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview & Analytics</TabsTrigger>
          <TabsTrigger value="approvals" className="relative">
            Regulatory Approvals
            {pendingSubmissions.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {pendingSubmissions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="submissions">Detailed Submissions</TabsTrigger>
          <TabsTrigger value="reviews">Reviews Management</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            {/* Key Metrics Cards - Include pending submissions count */}
            <div className="grid gap-6 md:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Approvals
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[120px]">
                  <p className="text-4xl font-bold text-orange-600">{pendingSubmissions.length}</p>
                  <p className="text-muted-foreground">awaiting review</p>
                </CardContent>
              </Card>

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

        {/* NEW: Regulatory Approvals Tab - ✅ FIXED SAFE PROPERTY ACCESS */}
        <TabsContent value="approvals">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Pending Submissions for Regulatory Approval
                  <Badge variant="outline">{pendingSubmissions.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Two-stage approval workflow: Insurer submission → Regulator approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(pendingSubmissions) && pendingSubmissions.length > 0 ? (
                    pendingSubmissions.map((submission, index) => {
                      // ✅ COMPLETELY SAFE SUBMISSION HANDLING
                      if (!submission) return null;
                      
                      const submissionId = submission.id || `submission-${index}`;
                      const insurerUsername = (submission.insurer && submission.insurer.username) || 'Unknown Insurer';
                      const insurerEmail = (submission.insurer && submission.insurer.email) || 'N/A';
                      const dataHash = submission.data_hash || 'N/A';
                      const capital = submission.capital || 0;
                      const liabilities = submission.liabilities || 0;
                      const solvencyRatio = submission.solvency_ratio || 0;
                      const submissionDate = submission.submission_date;
                      const status = submission.status || 'UNKNOWN';
                      
                      return (
                        <div key={submissionId} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-white">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-lg">{insurerUsername}</h4>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                Data Hash: <code className="bg-gray-100 px-1 rounded text-xs">{dataHash.substring(0, 20)}...</code>
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Email: {insurerEmail}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(status)}
                              <span className="text-xs text-muted-foreground">
                                {submissionDate ? new Date(submissionDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-white rounded border">
                            <div>
                              <label className="text-xs text-muted-foreground font-medium">Capital (KES)</label>
                              <p className="font-bold text-green-600">{capital.toLocaleString()}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground font-medium">Liabilities (KES)</label>
                              <p className="font-bold text-red-600">{liabilities.toLocaleString()}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground font-medium">Solvency Ratio</label>
                              <p className={`font-bold text-lg ${solvencyRatio >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                {solvencyRatio}%
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground font-medium">Risk Level</label>
                              <Badge variant={solvencyRatio >= 100 ? 'default' : 'destructive'}>
                                {solvencyRatio >= 100 ? 'Low Risk' : 'High Risk'}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => setSelectedPendingSubmission(submission)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Review & Approve
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <FileCheck className="h-5 w-5" />
                                    Regulatory Review & Approval
                                  </DialogTitle>
                                  <DialogDescription>
                                    Complete the two-stage approval process for this financial submission
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {selectedPendingSubmission && (
                                  <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
                                      <div className="space-y-3">
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Insurer Details</label>
                                          <p className="font-semibold">{(selectedPendingSubmission.insurer && selectedPendingSubmission.insurer.username) || 'Unknown'}</p>
                                          <p className="text-sm text-gray-600">{(selectedPendingSubmission.insurer && selectedPendingSubmission.insurer.email) || 'No email'}</p>
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <div>
                                          <label className="text-sm font-medium text-gray-700">Data Hash</label>
                                          <p className="text-xs font-mono bg-gray-200 p-2 rounded break-all">
                                            {selectedPendingSubmission.data_hash || 'No hash'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <label className="text-sm font-medium">Regulatory Decision Comments</label>
                                      <Textarea 
                                        value={approvalComments}
                                        onChange={(e) => setApprovalComments(e.target.value)}
                                        placeholder="Provide regulatory comments and reasoning for your decision..."
                                        className="mt-2 min-h-[100px]"
                                      />
                                    </div>
                                  </div>
                                )}
                                
                                <DialogFooter className="gap-2">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setSelectedPendingSubmission(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    onClick={rejectSubmission}
                                    disabled={isRejecting || isApproving}
                                  >
                                    {isRejecting ? 'Rejecting...' : 'Reject Submission'}
                                  </Button>
                                  <Button 
                                    onClick={approveSubmission}
                                    disabled={isApproving || isRejecting}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    {isApproving ? 'Approving...' : 'Approve Submission'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      );
                    }).filter(Boolean)
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileCheck className="mx-auto h-12 w-12 mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Pending Approvals</h3>
                      <p>All submissions have been processed or no new submissions are awaiting approval.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
                            {submission.submittedAt ? format(new Date(submission.submittedAt), 'PPP') : 'No date'}
                          </TableCell>
                          <TableCell>
                            {submission.capital?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell>
                            {submission.liabilities?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {submission.solvencyRatio?.toFixed(2) || '0.00'}
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
                            {review.reviewerName || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(review.status)}
                              {getStatusBadge(review.status)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate" title={review.comments}>
                              {review.comments || 'No comments'}
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

      {/* Review Dialog */}
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