import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubmissions, useLatestComplianceStatus } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { StatCard } from '@/components/shared/StatCard';
import { 
  FaDollarSign, 
  FaFileAlt, 
  FaChartLine,
  FaDownload,
  FaUser,
  FaCheck,
  FaTimes,
  FaChartBar,
  FaShieldAlt
} from 'react-icons/fa';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
// ✅ ADD: Missing import
import { RefreshCw } from 'lucide-react';

const COLORS = {
  compliant: 'hsl(var(--chart-2))',
  nonCompliant: 'hsl(var(--chart-5))',
  capital: 'hsl(var(--chart-1))',
  liabilities: 'hsl(var(--chart-4))',
  pending: 'hsl(var(--chart-3))',
};

export function InsurerDashboardPage() {
  const [timeRange, setTimeRange] = useState('30');
  const allSubmissions = useSubmissions();
  const latestStatus = useLatestComplianceStatus();
  const { user } = useAuthStore();
  const [capital, setCapital] = useState<string>('');
  const [liabilities, setLiabilities] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionHistory, setSubmissionHistory] = useState<any[]>([]);

  // ✅ REVERT: Use the original working endpoint
  const fetchSubmissionHistory = useCallback(async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      console.log('👤 Dashboard fetching for user ID:', userId);
      
      if (!userId) {
        console.error('❌ No user ID found');
        setSubmissionHistory([]);
        return;
      }
      
      const response = await fetch(`http://localhost:5000/api/submissions/user/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched user submission history:', data);
        
        // ✅ HANDLE: The actual API response format
        if (data.success && data.submissions) {
          const submissions = data.submissions.map((submission: any) => ({
            ...submission,
            // Ensure compatibility with existing code
            submission_date: submission.submission_date || submission.created_at,
            status: submission.status // Already in correct format
          }));
          
          setSubmissionHistory(submissions);
          
          // Log approved submissions specifically
          const approvedSubmissions = submissions.filter((s: any) => s.status === 'REGULATOR_APPROVED');
          console.log(`✅ Found ${approvedSubmissions.length} approved submissions`);
          
        } else {
          console.log('No submissions found in response');
          setSubmissionHistory([]);
        }
      } else {
        console.log('No submission history found or endpoint not available');
        setSubmissionHistory([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setSubmissionHistory([]);
    }
  }, []);

  useEffect(() => {
    fetchSubmissionHistory();
    // Auto-refresh every 30 seconds to check for new approvals
    const interval = setInterval(fetchSubmissionHistory, 30000);
    return () => clearInterval(interval);
  }, [fetchSubmissionHistory]);

  const filteredSubmissions = submissionHistory
    .slice()
    .sort((a, b) => new Date(a.submission_date || a.created_at).getTime() - new Date(b.submission_date || b.created_at).getTime())
    .slice(-parseInt(timeRange));

  const chartData = filteredSubmissions.map((s: any) => ({
    date: format(new Date(s.submission_date || s.created_at), 'yyyy-MM-dd'),
    solvencyRatio: s.solvency_ratio || 0,
    capital: s.capital || 0,
    liabilities: s.liabilities || 0,
    status: s.status === 'REGULATOR_APPROVED' ? 'Compliant' : 'Non-Compliant',
  }));

  const complianceDistribution = filteredSubmissions.reduce((acc, s: any) => {
    if (s.status === 'REGULATOR_APPROVED') acc[0].value += 1;
    else if (s.status === 'REJECTED') acc[1].value += 1;
    else acc[2].value += 1; // Pending
    return acc;
  }, [
    { name: 'Approved', value: 0, color: COLORS.compliant },
    { name: 'Rejected', value: 0, color: COLORS.nonCompliant },
    { name: 'Pending', value: 0, color: COLORS.pending },
  ]);

  const averageSolvencyRatio = filteredSubmissions.length > 0
    ? filteredSubmissions.reduce((sum, s: any) => sum + (s.solvency_ratio || 0), 0) / filteredSubmissions.length
    : 0;

  // ✅ FIXED: Get latest approved status with the correct API format
  const userLatestStatus = submissionHistory.length > 0 
    ? submissionHistory
        .filter((s: any) => s.status === 'REGULATOR_APPROVED' && s.regulator_approved_at)
        .sort((a: any, b: any) => new Date(b.regulator_approved_at).getTime() - new Date(a.regulator_approved_at).getTime())[0]
    : null;

  console.log('📊 Latest approved status:', userLatestStatus);

  const handleExport = () => {
    if (chartData.length === 0) {
      toast.warning("No data to export.");
      return;
    }
    const headers = "Date,Capital (KES),Liabilities (KES),Solvency Ratio,Status";
    const csvContent = [
      headers,
      ...chartData.map((d: any) => `${d.date},${d.capital},${d.liabilities},${d.solvencyRatio.toFixed(4)},${d.status}`)
    ].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `solvasure_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Report downloaded successfully.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 FORM SUBMITTED - Starting blockchain process');
    console.log('📊 Capital:', capital);
    console.log('📊 Liabilities:', liabilities);
    console.log('👤 User from auth store:', user);
    
    if (!capital || !liabilities) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      console.log('👤 Using user ID for submission:', userId);
      
      const payload = {
        capital: parseFloat(capital),
        liabilities: parseFloat(liabilities),
        insurer_id: userId,
        comments: comments,
      };
      
      console.log('📦 Payload being sent:', payload);
      console.log('📡 Making API call to: http://localhost:5000/api/insurer/submit-data');

      const response = await fetch('http://localhost:5000/api/insurer/submit-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📨 Response status:', response.status);
      console.log('📨 Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📨 Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📨 Response data:', data);

      console.log('✅ Blockchain submission successful!');
      
      toast.success('CFO Submission Complete! ⛓️', {
        description: `Blockchain verified (Hash: ${data.submission_hash?.substring(0, 8)}...) - Awaiting regulator approval`
      });
      
      // Reset form
      setCapital('');
      setLiabilities('');
      setComments('');
      
      // Refresh submission history
      await fetchSubmissionHistory();
      
    } catch (error: any) {
      console.error('❌ Submission error:', error);
      console.error('❌ Error details:', error.message);
      
      toast.error('Submission Failed', {
        description: error.message || 'Unable to submit data'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const testBlockchainAPI = async () => {
    console.log('🧪 Testing API call directly...');
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      const response = await fetch('http://localhost:5000/api/insurer/submit-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capital: 1000000,
          liabilities: 800000,
          insurer_id: userId,
          comments: 'Test submission'
        })
      });
      const data = await response.json();
      console.log('🧪 Test API response:', data);
      
      if (response.ok) {
        toast.success('✅ API Test Successful!', {
          description: `Hash: ${data.submission_hash?.substring(0, 8)}...`
        });
        await fetchSubmissionHistory();
      } else {
        toast.error('❌ API Test Failed', {
          description: data.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('🧪 Test API error:', error);
      toast.error('❌ API Test Failed', {
        description: 'Network error'
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Insurer Dashboard</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={fetchSubmissionHistory}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <FaUser className="h-4 w-4" />
            Welcome, {user?.username || JSON.parse(localStorage.getItem('currentUser') || '{}')?.username || 'User'}
          </div>
        </div>
      </div>

      {/* ✅ ADD: Show approved submissions prominently */}
      {userLatestStatus && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <FaCheck className="h-5 w-5" />
              Latest Regulatory Approval
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Approved
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-green-800">
                  Transaction #{userLatestStatus.id}
                </div>
                <div className="text-sm text-green-700">
                  Approved: {format(new Date(userLatestStatus.regulator_approved_at), 'PPP pp')}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Capital:</span>
                    <div className="font-medium text-green-700">KES {userLatestStatus.capital?.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Liabilities:</span>
                    <div className="font-medium text-red-600">KES {userLatestStatus.liabilities?.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Solvency:</span>
                    <div className="font-medium text-blue-700">{userLatestStatus.solvency_ratio}%</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                {userLatestStatus.regulator_comments && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Regulator Comments:</div>
                    <div className="text-sm bg-white p-2 rounded border text-gray-700">
                      {userLatestStatus.regulator_comments}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Latest Capital"
          value={`KES ${userLatestStatus?.capital?.toLocaleString() || '0'}`}
          icon={<FaDollarSign />}
          description="Current capital amount"
        />
        <StatCard
          title="Latest Liabilities"
          value={`KES ${userLatestStatus?.liabilities?.toLocaleString() || '0'}`}
          icon={<FaFileAlt />}
          description="Current liabilities"
        />
        <StatCard
          title="Solvency Ratio"
          value={`${userLatestStatus?.solvency_ratio?.toFixed(2) || '0'}%`}
          icon={<FaChartLine />} 
          description="Current solvency status"
        />
        <StatCard
          title="Total Submissions"
          value={submissionHistory.length.toString()}
          icon={<FaShieldAlt />}
          description="All submissions"
        />
      </div>

      {/* ✅ ENHANCED: Show submission history with approval status */}
      {submissionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {submissionHistory.slice(0, 5).map((submission: any, index: number) => (
                <div key={submission.id || index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium">Transaction #{submission.id}</span>
                        <Badge className={
                          submission.status === 'REGULATOR_APPROVED' ? 'bg-green-100 text-green-800' :
                          submission.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {submission.status === 'REGULATOR_APPROVED' ? 'Approved' :
                           submission.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Capital:</span>
                          <div className="font-medium">KES {submission.capital?.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Liabilities:</span>
                          <div className="font-medium">KES {submission.liabilities?.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Solvency Ratio:</span>
                          <div className="font-medium">{submission.solvency_ratio || 'Calculating...'}%</div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        Submitted: {format(new Date(submission.submission_date || submission.created_at), 'PPp')}
                      </div>
                      
                      {/* ✅ SHOW APPROVAL DETAILS */}
                      {submission.status === 'REGULATOR_APPROVED' && submission.regulator_approved_at && (
                        <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                          <div className="text-xs font-medium text-green-800">
                            ✅ Approved: {format(new Date(submission.regulator_approved_at), 'PPP pp')}
                          </div>
                          {submission.regulator_comments && (
                            <div className="text-xs text-green-700 mt-1">
                              "{submission.regulator_comments}"
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* ✅ SHOW REJECTION DETAILS */}
                      {submission.status === 'REJECTED' && submission.regulator_rejected_at && (
                        <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                          <div className="text-xs font-medium text-red-800">
                            ❌ Rejected: {format(new Date(submission.regulator_rejected_at), 'PPP pp')}
                          </div>
                          {submission.regulator_comments && (
                            <div className="text-xs text-red-700 mt-1">
                              "{submission.regulator_comments}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Overview Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Solvency Ratio Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Solvency Ratio Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="solvencyRatio" 
                  stroke={COLORS.capital} 
                  strokeWidth={2}
                  name="Solvency Ratio (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Capital vs Liabilities */}
        <Card>
          <CardHeader>
            <CardTitle>Capital vs Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="capital" fill={COLORS.capital} name="Capital" />
                <Bar dataKey="liabilities" fill={COLORS.liabilities} name="Liabilities" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Distribution */}
      {complianceDistribution.some(item => item.value > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Submission Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={complianceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {complianceDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Time Range Selector and Export */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Financial Overview</h2>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <FaDownload className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{filteredSubmissions.length}</div>
              <div className="text-sm text-muted-foreground">Total Submissions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{averageSolvencyRatio.toFixed(2)}%</div>
              <div className="text-sm text-muted-foreground">Average Solvency Ratio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{complianceDistribution[0].value}</div>
              <div className="text-sm text-muted-foreground">Approved Submissions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{complianceDistribution[1].value}</div>
              <div className="text-sm text-muted-foreground">Rejected Submissions</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
