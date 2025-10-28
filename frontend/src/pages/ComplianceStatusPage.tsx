import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  FileCheck,
  Shield,
  Eye,
  RefreshCw,
  Loader2,
  FileX
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export function ComplianceStatusPage() {
  const [complianceData, setComplianceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComplianceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current user
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      if (!userId) {
        throw new Error('User not found');
      }

      console.log('🔍 Fetching compliance data for user:', userId);

      const response = await fetch(`http://localhost:5000/api/submissions/user/${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setComplianceData(null);
          return;
        }
        throw new Error(`HTTP ${response.status}: Failed to fetch submissions`);
      }
      
      const data = await response.json();
      console.log('📊 Full submissions response:', data);
      
      // ✅ HANDLE: The actual API response format
      if (!data.success || !data.submissions || data.submissions.length === 0) {
        console.log('📊 No submissions found in response');
        setComplianceData(null);
        return;
      }

      const submissions = data.submissions;
      console.log('📊 Processing submissions:', submissions.length);

      // ✅ FIXED: Get the latest approved submission
      const approvedSubmissions = submissions.filter((s: any) => {
        console.log(`📋 Checking submission ${s.id}:`, {
          status: s.status,
          regulator_approved_at: s.regulator_approved_at,
          has_approval_date: s.has_approval_date
        });
        return s.status === 'REGULATOR_APPROVED' && s.regulator_approved_at;
      });
      
      console.log('✅ Found approved submissions:', approvedSubmissions.length);
      
      if (approvedSubmissions.length === 0) {
        console.log('📊 No approved submissions found');
        setComplianceData(null);
        return;
      }

      // Sort by approval date to get the most recent
      const latestApproved = approvedSubmissions.sort((a: any, b: any) => 
        new Date(b.regulator_approved_at).getTime() - new Date(a.regulator_approved_at).getTime()
      )[0];

      console.log('🎯 Latest approved submission:', latestApproved);

      // ✅ BUILD: Comprehensive compliance data
      const complianceStatus = {
        submissionId: latestApproved.id,
        capital: latestApproved.capital,
        liabilities: latestApproved.liabilities,
        solvencyRatio: latestApproved.solvency_ratio,
        status: latestApproved.status,
        approvalDate: latestApproved.regulator_approved_at,
        regulatorComments: latestApproved.regulator_comments,
        dataHash: latestApproved.data_hash,
        submissionDate: latestApproved.submission_date || latestApproved.created_at,
        
        // Compliance metrics
        isCompliant: latestApproved.solvency_ratio >= 100,
        riskLevel: getRiskLevel(latestApproved.solvency_ratio),
        
        // Historical context
        totalSubmissions: submissions.length,
        approvedSubmissions: approvedSubmissions.length,
        rejectedSubmissions: submissions.filter((s: any) => s.status === 'REJECTED').length,
        pendingSubmissions: submissions.filter((s: any) => s.status === 'INSURER_SUBMITTED').length,
        
        // Trend analysis
        trend: calculateTrend(approvedSubmissions),
        
        // AI extraction if available
        aiExtraction: latestApproved.ai_extraction || null
      };

      setComplianceData(complianceStatus);
      console.log('🎯 Final compliance data:', complianceStatus);
      
    } catch (err: any) {
      console.error('❌ Error fetching compliance data:', err);
      setError(err.message || 'Failed to fetch compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper functions
  const getRiskLevel = (ratio: number): 'low' | 'medium' | 'high' => {
    if (ratio >= 200) return 'low';
    if (ratio >= 100) return 'medium';
    return 'high';
  };

  const calculateTrend = (approvedSubmissions: any[]): 'improving' | 'stable' | 'declining' => {
    if (approvedSubmissions.length < 2) return 'stable';
    
    const sortedByDate = approvedSubmissions.sort((a, b) => 
      new Date(a.regulator_approved_at).getTime() - new Date(b.regulator_approved_at).getTime()
    );
    
    const latest = sortedByDate[sortedByDate.length - 1];
    const previous = sortedByDate[sortedByDate.length - 2];
    
    if (latest.solvency_ratio > previous.solvency_ratio * 1.05) return 'improving';
    if (latest.solvency_ratio < previous.solvency_ratio * 0.95) return 'declining';
    return 'stable';
  };

  useEffect(() => {
    fetchComplianceData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchComplianceData, 30000);
    return () => clearInterval(interval);
  }, [fetchComplianceData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading compliance status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchComplianceData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!complianceData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Approved Submissions</h3>
            <p className="text-muted-foreground mb-4">
              You don't have any approved submissions yet. Submit your financial data for regulatory review.
            </p>
            <Button asChild>
              <Link to="/app/data-input">
                Submit Financial Data
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance Status</h1>
          <p className="text-muted-foreground">
            Latest regulatory approval from {complianceData.approvalDate ? format(new Date(complianceData.approvalDate), 'PPP') : 'N/A'}
          </p>
        </div>
        <Button variant="outline" onClick={fetchComplianceData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* ✅ MAIN: Regulatory Approval Details */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            Latest Regulatory Approval
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Approved
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-green-800 mb-1">
                  Submission #{complianceData.submissionId}
                </div>
                <div className="text-sm text-green-700">
                  Approved: {format(new Date(complianceData.approvalDate), 'PPP pp')}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-600">Capital</div>
                  <div className="font-semibold text-green-700">
                    KES {complianceData.capital?.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Solvency Ratio</div>
                  <div className="font-semibold text-blue-700">
                    {complianceData.solvencyRatio}%
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              {complianceData.regulatorComments && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-2">Regulator Comments:</div>
                  <div className="text-sm bg-white p-3 rounded border text-gray-700 border-green-200">
                    "{complianceData.regulatorComments}"
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {complianceData.isCompliant ? 'Compliant' : 'Non-Compliant'}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on latest approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
            <Shield className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getRiskLevelColor(complianceData.riskLevel)}>
                {complianceData.riskLevel.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Risk assessment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend</CardTitle>
            {getTrendIcon(complianceData.trend)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {complianceData.trend}
            </div>
            <p className="text-xs text-muted-foreground">
              Performance trend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileCheck className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{complianceData.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground">
              {complianceData.approvedSubmissions} approved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional compliance details can be added here */}
    </div>
  );
}