import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useAuditStore, type AuditReview } from '../stores/auditStore';
import { useAuthStore } from '../stores/authStore';
import { CheckCircle, XCircle, AlertCircle, Eye, MessageSquare, Download, FileCheck, Users, MapPin, Building, Bell, Clock, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FaCheck, FaTimes, FaFileAlt, FaUser } from 'react-icons/fa';
import { z } from 'zod';
import { useForm } from 'react-hook-form';

const COLORS = { compliant: 'hsl(var(--chart-2))', nonCompliant: 'hsl(var(--chart-5))' };

// Add new interfaces for regulator functionality
interface ExtractionMetadata {
  confidence_score?: string;
  currency_detected?: string;
  period_covered?: string;
}

interface ComplianceMetrics {
  car?: number;
  required_capital?: number;
  available_capital?: number;
  asset_adequacy?: boolean | string;
  insurance_service_result?: number;
  insurance_revenue_growth?: number;
  insurance_liabilities_adequacy?: boolean | string;
  reinsurance_strategy?: string;
  claims_development?: string;
  internal_controls?: string;
  board_structure?: string;
  board_committee_oversight?: string;
  related_party_transactions?: string;
  investment_policy_submission?: string;
}

interface PendingSubmission {
  id: number | string;
  data_hash?: string;
  capital: number;
  liabilities: number;
  solvency_ratio: number;
  insurer?: {
    username?: string;
    email?: string;
  };
  status: string;

  ai_extraction?: ComplianceMetrics;
  submission_date?: string;
  financial_statement_url?: string;
  financial_statement_filename?: string;
  // Manual input fields (optional) used in the UI:
  gwp?: number | string;
  net_claims_paid?: number | string;
  investment_income_total?: number | string;
  commission_expense_total?: number | string;
  operating_expenses_total?: number | string;
  profit_before_tax?: number | string;
  contingency_reserve_statutory?: number | string;
  ibnr_reserve_gross?: number | string;
  irfs17_implementation_status?: string;
  related_party_net_exposure?: number | string;
  claims_development_method?: string;
  auditors_unqualified_opinion?: boolean | null;
  risk_assessment?: {
    underwriting_risk?: number;
    market_risk?: number;
    credit_risk?: number;
    operational_risk?: number;
  };
  orsa_status?: string;
  last_stress_test?: string;
  stress_test_complete?: boolean;
}

interface RegulatorNotification {
  id: number | string;
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [aiInsurerId, setAiInsurerId] = useState<string>('');
  const [aiUploading, setAiUploading] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState<any | null>(null);
  const [riskAssessments, setRiskAssessments] = useState<any[]>([]);
  const [stressTests, setStressTests] = useState<any[]>([]);

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

  const fetchRiskAssessments = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/regulator/risk-assessments');
      if (response.ok) {
        const data = await response.json();
        setRiskAssessments(data.assessments || []);
      }
    } catch (error) {
      console.error('Error fetching risk assessments:', error);
    }
  };

  const fetchStressTests = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/regulator/stress-tests');
      if (response.ok) {
        const data = await response.json();
        setStressTests(data.tests || []);
      }
    } catch (error) {
      console.error('Error fetching stress tests:', error);
    }
  };

  const approveSubmission = async () => {
    if (!selectedPendingSubmission) return;

    setIsApproving(true);
    try {
      const response = await fetch('http://localhost:5000/api/regulator/approve-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: selectedPendingSubmission.id,
          comments: approvalComments || 'Approved by regulator'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const shortHash = selectedPendingSubmission.data_hash ? `${String(selectedPendingSubmission.data_hash).substring(0, 8)}...` : '';
        toast.success('Submission Approved!', {
          description: `Data hash ${shortHash} has been approved.`
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
      toast.error('Network Error', { description: 'Could not connect to server' });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: selectedPendingSubmission.id,
          comments: approvalComments || 'Submission rejected by regulator'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const shortHash = selectedPendingSubmission.data_hash ? `${String(selectedPendingSubmission.data_hash).substring(0, 8)}...` : '';
        toast.success('Submission Rejected', {
          description: `Data hash ${shortHash} has been rejected.`
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
      toast.error('Network Error', { description: 'Could not connect to server' });
    } finally {
      setIsRejecting(false);
    }
  };

  const uploadAndSummarize = async () => {
    const fileEl = fileInputRef.current;
    if (!fileEl || !fileEl.files || fileEl.files.length === 0) {
      toast.error('Please select a PDF file to upload');
      return;
    }
    const file = fileEl.files[0];
    setAiUploading(true);
    setAiSummaryResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (aiInsurerId) fd.append('insurer_id', aiInsurerId);

      const resp = await fetch('http://localhost:5000/api/regulator/upload-and-summarize', {
        method: 'POST',
        body: fd
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success('AI summary generated');
        setAiSummaryResult(data);
      } else {
        toast.error('AI summarization failed', { description: data.error || 'Server error' });
        setAiSummaryResult({ error: data.error || 'Failed' });
      }
    } catch (err) {
      toast.error('Network error while uploading');
      setAiSummaryResult({ error: 'Network error' });
    } finally {
      setAiUploading(false);
    }
  };

  const approveRiskAssessment = async (assessmentId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/regulator/approve-risk/${assessmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        toast.success('Risk assessment approved');
        fetchRiskAssessments();
      } else {
        toast.error('Failed to approve risk assessment');
      }
    } catch (error) {
      toast.error('Failed to approve risk assessment');
    }
  };

  useEffect(() => {
    if (fetchReviews && fetchSubmissions) {
      fetchReviews();
      fetchSubmissions();
    }

    // Existing regulator data
    fetchPendingSubmissions();
    fetchRegulatorNotifications();

    // NEW: Add risk management data
    fetchRiskAssessments();
    fetchStressTests();

    // Refresh all data every 30 seconds
    const interval = setInterval(() => {
      fetchPendingSubmissions();
      fetchRegulatorNotifications();
      fetchRiskAssessments();
      fetchStressTests();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchReviews, fetchSubmissions, fetchRegulatorNotifications]);

  // Enhanced data processing
  const anonymizedData = useMemo(() =>
    submissions ? submissions.map((s: any) => ({
      ...s,
      insurerId: `INS-${(String(s.id).charCodeAt(String(s.id).length - 1) % 5) + 101}`,
      solvencyRatio: s.capital / (s.liabilities || 1)
    })) : [], [submissions]);

  const filteredData = useMemo(() =>
    anonymizedData.filter((s: any) =>
      (insurerIdFilter === 'all' || s.insurerId === insurerIdFilter) &&
      (statusFilter === 'all' || s.status === statusFilter)
    ), [anonymizedData, insurerIdFilter, statusFilter]);

  const complianceDistribution = useMemo(() => {
    const compliant = filteredData.filter((s: any) => s.solvencyRatio >= 1).length;
    const nonCompliant = filteredData.length - compliant;
    return [
      { name: 'Compliant', value: compliant },
      { name: 'Non-Compliant', value: nonCompliant }
    ];
  }, [filteredData]);

  const averageSolvencyRatio = useMemo(() =>
    filteredData.length === 0 ? 0 :
      filteredData.reduce((sum: number, s: any) => sum + (s.solvencyRatio || 0), 0) / filteredData.length,
    [filteredData]
  );

  const compliancePercentage = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const compliant = filteredData.filter((s: any) => s.solvencyRatio >= 1).length;
    return (compliant / filteredData.length) * 100;
  }, [filteredData]);

  const uniqueInsurerIds = useMemo(() =>
    [...new Set(anonymizedData.map((s: any) => s.insurerId))].sort(),
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

    const config = (statusConfig as any)[displayStatus] || statusConfig.pending;

    return (
      <Badge variant={config.variant} className={config.className}>
        {String(displayStatus).replace('_', ' ').toUpperCase()}
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

  // Stress testing component
  function StressTestCalculator() {
    const [currentSolvency, setCurrentSolvency] = useState(0);
    const [stressScenario, setStressScenario] = useState({
      marketDecline: 0,    // Percentage
      claimsIncrease: 0,   // Percentage
      economicImpact: 0    // Percentage
    });

    const calculateStressedSolvency = () => {
      // Get current capital and liabilities
      const currentCapital = currentSolvency; // Use state value for current capital
      const currentLiabilities = 1; // avoid division by zero
      // Apply stress factors
      const stressedCapital = currentCapital * (1 - stressScenario.marketDecline / 100);
      const stressedLiabilities = currentLiabilities * (1 + stressScenario.claimsIncrease / 100);
      // Calculate new solvency ratio
      const stressedRatio = (stressedCapital / stressedLiabilities) * 100;
      return {
        stressedRatio,
        stillCompliant: stressedRatio >= 100,
        capitalShortfall: stressedRatio < 100 ? (stressedLiabilities - stressedCapital) : 0
      };
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Stress Test Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label>Market Decline (%)</label>
              <input
                type="range"
                min="0"
                max="50"
                value={stressScenario.marketDecline}
                onChange={(e) => setStressScenario({
                  ...stressScenario,
                  marketDecline: parseInt(e.target.value)
                })}
              />
              <span>{stressScenario.marketDecline}%</span>
            </div>

            <div>
              <label>Claims Increase (%)</label>
              <input
                type="range"
                min="0"
                max="200"
                value={stressScenario.claimsIncrease}
                onChange={(e) => setStressScenario({
                  ...stressScenario,
                  claimsIncrease: parseInt(e.target.value)
                })}
              />
              <span>{stressScenario.claimsIncrease}%</span>
            </div>

            <StressTestResults result={calculateStressedSolvency()} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Add missing StressTestResults component
  function StressTestResults({ result }: { result: { stressedRatio: number; stillCompliant: boolean; capitalShortfall: number } }) {
    return (
      <div className="mt-4 p-4 border rounded-lg bg-gray-50">
        <div className="flex flex-col gap-2">
          <div>
            <span className="font-medium">Stressed Solvency Ratio: </span>
            <span className={result.stillCompliant ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
              {isNaN(result.stressedRatio) ? 'N/A' : result.stressedRatio.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="font-medium">Compliance Status: </span>
            <span className={result.stillCompliant ? 'text-green-600' : 'text-red-600'}>
              {result.stillCompliant ? 'Compliant' : 'Non-Compliant'}
            </span>
          </div>
          {!result.stillCompliant && (
            <div>
              <span className="font-medium">Capital Shortfall: </span>
              <span className="text-red-600">
                {isNaN(result.capitalShortfall) ? 'N/A' : result.capitalShortfall.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview & Analytics</TabsTrigger>
          <TabsTrigger value="approvals" className="relative">
            Regulatory Approvals
            {pendingSubmissions.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {pendingSubmissions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="risk-management">Risk Management</TabsTrigger>
          <TabsTrigger value="submissions">Detailed Submissions</TabsTrigger>
          <TabsTrigger value="reviews">Reviews Management</TabsTrigger>
          <TabsTrigger value="ai-summaries">AI Summaries</TabsTrigger>
        </TabsList>

        {/* Overview */}
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

        {/* Approvals */}
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
                                Data Hash: <code className="bg-gray-100 px-1 rounded text-xs">{String(dataHash).substring(0, 20)}...</code>
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
                              <p className="font-bold text-green-600">{Number(capital).toLocaleString()}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground font-medium">Liabilities (KES)</label>
                              <p className="font-bold text-red-600">{Number(liabilities).toLocaleString()}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground font-medium">Solvency Ratio</label>
                              <p className={`font-bold text-lg ${solvencyRatio >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                                {solvencyRatio}%
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" onClick={() => setSelectedPendingSubmission(submission)}>
                                  Review &amp; Approve
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <div className="max-h-[70vh] w-full overflow-y-auto pr-2">
                                  <DialogHeader>
                                    <DialogTitle>Review &amp; Approve Submission</DialogTitle>
                                    <DialogDescription>
                                      Please review the submission details and leave a comment before approving or rejecting.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-semibold">Insurer:</span> {insurerUsername}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Data Hash:</span> <code>{dataHash}</code>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Capital:</span> {Number(capital).toLocaleString()}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Liabilities:</span> {Number(liabilities).toLocaleString()}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Solvency Ratio:</span> {solvencyRatio}%
                                    </div>

                                    {/* Manual Inputs Summary */}
                                    <div className="mt-4 p-4 bg-gray-50 rounded border">
                                      <h5 className="font-semibold mb-2">Manual Inputs Summary</h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                        <div><b>GWP:</b> {submission.gwp ?? 'N/A'}</div>
                                        <div><b>Net Claims Paid:</b> {submission.net_claims_paid ?? 'N/A'}</div>
                                        <div><b>Investment Income (Total):</b> {submission.investment_income_total ?? 'N/A'}</div>
                                        <div><b>Commission Expense (Total):</b> {submission.commission_expense_total ?? 'N/A'}</div>
                                        <div><b>Operating Expenses (Total):</b> {submission.operating_expenses_total ?? 'N/A'}</div>
                                        <div><b>Profit Before Tax:</b> {submission.profit_before_tax ?? 'N/A'}</div>
                                        <div><b>Contingency Reserve (Statutory):</b> {submission.contingency_reserve_statutory ?? 'N/A'}</div>
                                        <div><b>IBNR Reserve (Gross):</b> {submission.ibnr_reserve_gross ?? 'N/A'}</div>
                                        <div><b>IFRS17 Status:</b> {submission.irfs17_implementation_status ?? 'N/A'}</div>
                                        <div><b>Related Party Net Exposure:</b> {submission.related_party_net_exposure ?? 'N/A'}</div>
                                        <div><b>Claims Development Method:</b> {submission.claims_development_method ?? 'N/A'}</div>
                                        <div><b>Auditors Unqualified Opinion:</b> {submission.auditors_unqualified_opinion ? 'Yes' : (submission.auditors_unqualified_opinion === false ? 'No' : 'N/A')}</div>
                                      </div>

                                      {/* File link for manual verification */}
                                      {submission.financial_statement_url && (
                                        <div className="mt-3">
                                          <a
                                            href={submission.financial_statement_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 underline"
                                          >
                                            View uploaded financial statement {submission.financial_statement_filename ? `(${submission.financial_statement_filename})` : ''}
                                          </a>
                                        </div>
                                      )}
                                    </div>

                                    {/* Show only the new compliance metrics */}
                                    {submission.ai_extraction && (
                                      <div className="mt-4 p-4 bg-gray-50 rounded border">
                                        <h5 className="font-semibold mb-2">Compliance Metrics Overview</h5>
                                        <ul className="text-sm space-y-1">
                                          <li><b>Capital Adequacy Ratio (CAR):</b> {submission.ai_extraction.car ?? 'N/A'}</li>
                                          <li><b>Required Capital:</b> {submission.ai_extraction.required_capital ?? 'N/A'}</li>
                                          <li><b>Available Capital:</b> {submission.ai_extraction.available_capital ?? 'N/A'}</li>
                                          <li><b>Asset Adequacy:</b> {String(submission.ai_extraction.asset_adequacy ?? 'N/A')}</li>
                                          <li><b>Insurance Service Result:</b> {submission.ai_extraction.insurance_service_result ?? 'N/A'}</li>
                                          <li><b>Insurance Revenue Growth:</b> {submission.ai_extraction.insurance_revenue_growth ?? 'N/A'}</li>
                                          <li><b>Adequacy of Insurance Liabilities:</b> {String(submission.ai_extraction.insurance_liabilities_adequacy ?? 'N/A')}</li>
                                          <li><b>Reinsurance Strategy & Credit Risk:</b> {submission.ai_extraction.reinsurance_strategy ?? 'N/A'}</li>
                                          <li><b>Claims Development/Reserving:</b> {submission.ai_extraction.claims_development ?? 'N/A'}</li>
                                          <li><b>Internal Controls:</b> {submission.ai_extraction.internal_controls ?? 'N/A'}</li>
                                          <li><b>Board Structure & Independence:</b> {submission.ai_extraction.board_structure ?? 'N/A'}</li>
                                          <li><b>Board Committee Oversight:</b> {submission.ai_extraction.board_committee_oversight ?? 'N/A'}</li>
                                          <li><b>Related Party Transactions:</b> {submission.ai_extraction.related_party_transactions ?? 'N/A'}</li>
                                          <li><b>Investment Policy Submission:</b> {submission.ai_extraction.investment_policy_submission ?? 'N/A'}</li>
                                        </ul>
                                      </div>
                                    )}
                                    <Label htmlFor="approvalComments" className="mt-2">Comments</Label>
                                    <Textarea
                                      id="approvalComments"
                                      value={approvalComments}
                                      onChange={e => setApprovalComments(e.target.value)}
                                      placeholder="Leave a comment (required for rejection)"
                                    />
                                  </div>
                                  <DialogFooter className="sticky bottom-0 bg-white/90 mt-4 pt-2">
                                    <Button
                                      variant="destructive"
                                      onClick={rejectSubmission}
                                      disabled={isRejecting}
                                    >
                                      {isRejecting ? 'Rejecting...' : 'Reject'}
                                    </Button>
                                    <Button
                                      variant="default"
                                      onClick={approveSubmission}
                                      disabled={isApproving}
                                    >
                                      {isApproving ? 'Approving...' : 'Approve'}
                                    </Button>
                                  </DialogFooter>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-muted-foreground">No pending submissions for approval.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Summaries */}
        <TabsContent value="ai-summaries">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Summaries</CardTitle>
                <CardDescription>Upload an insurer financial statement (PDF). Regulator-only feature: generate a downloadable AI summary.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Insurer ID (optional)</Label>
                    <Input value={aiInsurerId} onChange={e => setAiInsurerId(e.target.value)} placeholder="Insurer ID (optional)" />
                  </div>
                  <div>
                    <Label>Financial Statement (PDF)</Label>
                    <input ref={fileInputRef} type="file" accept="application/pdf" />
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button onClick={uploadAndSummarize} disabled={aiUploading}>
                    {aiUploading ? 'Uploading & summarizing...' : 'Upload & Summarize'}
                  </Button>
                  <Button variant="outline" onClick={() => { setAiSummaryResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    Clear
                  </Button>
                </div>

                {aiUploading && <p className="text-sm text-muted-foreground mt-2">Please wait — summarization may take several seconds.</p>}

                {aiSummaryResult && (
                  <div className="mt-4 bg-gray-50 p-3 rounded border">
                    {aiSummaryResult.error ? (
                      <div className="text-red-600">Error: {aiSummaryResult.error}</div>
                    ) : (
                      <>
                        <h6 className="font-semibold">Narrative</h6>
                        <p className="whitespace-pre-wrap">{aiSummaryResult.summary?.narrative || 'No narrative'}</p>

                        <h6 className="font-semibold mt-3">Metrics</h6>
                        <pre className="text-xs bg-white p-2 rounded overflow-auto">{JSON.stringify(aiSummaryResult.summary?.metrics || {}, null, 2)}</pre>

                        {aiSummaryResult.download_summary_url && (
                          <div className="mt-3">
                            <a href={aiSummaryResult.download_summary_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                              Download summary JSON
                            </a>
                          </div>
                        )}

                        {aiSummaryResult.download_summary_pdf_url && (
                          <div className="mt-2">
                            <a href={aiSummaryResult.download_summary_pdf_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                              Download summary PDF
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reviews */}
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
                      const submission = submissions?.find((s: any) => s.id === review.submissionId);
                      const anonymizedId = submission ? `INS-${(String(submission.id).charCodeAt(String(submission.id).length - 1) % 5) + 101}` : 'Unknown';
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

        {/* Risk Management */}
        <TabsContent value="risk-management">
          <div className="space-y-6">
            {/* Risk Overview Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    High Risk Insurers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {pendingSubmissions.filter(s => (s.solvency_ratio ?? 0) < 100).length}
                  </div>
                  <p className="text-sm text-muted-foreground">Below 100% solvency</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Risk Assessments Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {pendingSubmissions.filter(s =>
                      !s.risk_assessment ||
                      Object.values(s.risk_assessment || {}).some((v: any) => v === undefined || v === null || v === 0)
                    ).length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Awaiting ORSA review</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Stress Tests Due
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {pendingSubmissions.filter(s => !s.stress_test_complete).length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Annual stress testing</p>
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment Table */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment Overview</CardTitle>
                <CardDescription>Monitor risk management compliance across all insurers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insurer</TableHead>
                      <TableHead>Solvency Ratio</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>ORSA Status</TableHead>
                      <TableHead>Last Stress Test</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSubmissions.map((submission) => {
                      const riskLevel = (submission.solvency_ratio ?? 0) >= 150 ? 'LOW' :
                        (submission.solvency_ratio ?? 0) >= 100 ? 'MEDIUM' : 'HIGH';
                      const riskColor = riskLevel === 'HIGH' ? 'text-red-600' :
                        riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600';

                      return (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">
                            {(submission.insurer && submission.insurer.username) || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <span className={((submission.solvency_ratio ?? 0) >= 100) ? 'text-green-600' : 'text-red-600'}>
                              {submission.solvency_ratio ?? 'N/A'}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={riskLevel === 'HIGH' ? 'destructive' : riskLevel === 'MEDIUM' ? 'secondary' : 'default'}>
                              {riskLevel} RISK
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {submission.orsa_status || 'PENDING'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {submission.last_stress_test || 'Not conducted'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => { /* open risk review */ }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Review Risk
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Update the existing dataInputSchema
const dataInputSchema = z.object({
  capital: z.string().min(1, 'Capital is required.'),
  liabilities: z.string().min(1, 'Liabilities is required.'),
  date: z.date(),
  financialStatement: z.any().optional(),
  // NEW: Add risk assessment fields
  underwritingRisk: z.string().optional(),
  marketRisk: z.string().optional(),
  creditRisk: z.string().optional(),
  operationalRisk: z.string().optional(),
});

<div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
  <div className="flex items-start gap-3">
    <AlertCircle className="h-5 w-5 text-purple-600 mt-1" />
    <div>
      <h4 className="font-medium text-purple-900">Risk Assessment (ORSA)</h4>
      <p className="text-sm text-purple-700 mt-1">
        Optional: Provide risk percentages for comprehensive ORSA reporting and enhanced regulatory compliance.
      </p>
    </div>
  </div>
</div>

