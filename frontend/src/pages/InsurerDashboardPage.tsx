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
import { toast } from 'sonner';

const COLORS = {
  compliant: 'hsl(var(--chart-2))',
  nonCompliant: 'hsl(var(--chart-5))',
  capital: 'hsl(var(--chart-1))',
  liabilities: 'hsl(var(--chart-4))',
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

  const fetchSubmissionHistory = useCallback(async () => {
    try {
      // ✅ FIX: Get current user ID properly
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      console.log('👤 Dashboard fetching for user ID:', userId);
      
      if (!userId) {
        console.error('❌ No user ID found');
        setSubmissionHistory([]);
        return;
      }
      
      // ✅ FIX: Use user-specific endpoint
      const response = await fetch(`http://localhost:5000/api/submissions/user/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched user submission history:', data);
        setSubmissionHistory(data.submissions || []);
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
  }, [fetchSubmissionHistory]);

  // Replace the filteredSubmissions, chartData, and related calculations with user-specific data:

  // ✅ FIX: Use submissionHistory (user-specific) instead of allSubmissions (all users)
  const filteredSubmissions = submissionHistory
    .slice()
    .sort((a, b) => new Date(a.submission_date || a.created_at).getTime() - new Date(b.submission_date || b.created_at).getTime())
    .slice(-parseInt(timeRange));

  // ✅ FIX: Generate chartData from user-specific submissions
  const chartData = filteredSubmissions.map(s => ({
    date: format(new Date(s.submission_date || s.created_at), 'yyyy-MM-dd'),
    solvencyRatio: s.solvency_ratio || 0,
    capital: s.capital || 0,
    liabilities: s.liabilities || 0,
    status: s.status === 'REGULATOR_APPROVED' ? 'Compliant' : 'Non-Compliant',
  }));

  // ✅ FIX: Calculate compliance from user-specific data
  const complianceDistribution = filteredSubmissions.reduce((acc, s) => {
    if (s.status === 'REGULATOR_APPROVED') acc[0].value += 1;
    else acc[1].value += 1;
    return acc;
  }, [
    { name: 'Compliant', value: 0 },
    { name: 'Non-Compliant', value: 0 },
  ]);

  // ✅ FIX: Calculate average from user-specific data
  const averageSolvencyRatio = filteredSubmissions.length > 0
    ? filteredSubmissions.reduce((sum, s) => sum + (s.solvency_ratio || 0), 0) / filteredSubmissions.length
    : 0;

  // ✅ FIX: Get latest status from user-specific data
  const userLatestStatus = submissionHistory.length > 0 
    ? submissionHistory
        .filter(s => s.status === 'REGULATOR_APPROVED')
        .sort((a, b) => new Date(b.regulator_approved_at || b.created_at).getTime() - new Date(a.regulator_approved_at || a.created_at).getTime())[0]
    : null;

  const handleExport = () => {
    if (chartData.length === 0) {
      toast.warning("No data to export.");
      return;
    }
    const headers = "Date,Capital (KES),Liabilities (KES),Solvency Ratio,Status";
    const csvContent = [
      headers,
      ...chartData.map(d => `${d.date},${d.capital},${d.liabilities},${d.solvencyRatio.toFixed(4)},${d.status}`)
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
      // ✅ FIX: Get current user ID properly
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      console.log('👤 Using user ID for submission:', userId);
      
      const payload = {
        capital: parseFloat(capital),
        liabilities: parseFloat(liabilities),
        insurer_id: userId, // ✅ FIX: Use actual current user ID
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
      // ✅ FIX: Get current user ID properly
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = currentUser.id;
      
      const response = await fetch('http://localhost:5000/api/insurer/submit-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capital: 1000000,
          liabilities: 800000,
          insurer_id: userId, // ✅ FIX: Use actual current user ID
          comments: 'Test submission'
        })
      });
      const data = await response.json();
      console.log('🧪 Test API response:', data);
      
      if (response.ok) {
        toast.success('✅ API Test Successful!', {
          description: `Hash: ${data.submission_hash?.substring(0, 8)}...`
        });
        await fetchSubmissionHistory(); // Refresh after test
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
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <FaUser className="h-4 w-4" />
          Welcome, {user?.username || JSON.parse(localStorage.getItem('currentUser') || '{}')?.username || 'User'}
        </div>
      </div>

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
          title="Compliance Status"
          value={userLatestStatus?.status === 'REGULATOR_APPROVED' ? 'Compliant' : 'Unknown'}
          icon={<FaShieldAlt />}
          description="Latest compliance check"
        />
      </div>

      {/* Submission History */}
      {submissionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FaFileAlt className="h-5 w-5" />
              Recent Blockchain Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {submissionHistory.slice(0, 5).map((submission, index) => (
                <div key={submission.id || index} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FaCheck className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Hash: {submission.data_hash?.substring(0, 8)}...</span>
                      <span className="text-sm text-muted-foreground">
                        Ratio: {submission.solvency_ratio}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 ml-6">
                      Capital: KES {submission.capital?.toLocaleString()} | 
                      Liabilities: KES {submission.liabilities?.toLocaleString()}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    submission.status === 'REGULATOR_APPROVED' ? 'bg-green-100 text-green-800' :
                    submission.status === 'INSURER_SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {submission.status}
                  </span>
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
            <CardTitle className="flex items-center gap-2">
              <FaChartLine className="h-5 w-5" />
              Solvency Ratio Trend
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <FaChartBar className="h-5 w-5" />
              Capital vs Liabilities
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <FaShieldAlt className="h-5 w-5" />
              Compliance Status Distribution
            </CardTitle>
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
                      fill={entry.name === 'Compliant' ? COLORS.compliant : COLORS.nonCompliant} 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FaChartBar className="h-5 w-5" />
          Financial Overview
        </h2>
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
          <CardTitle className="flex items-center gap-2">
            <FaChartBar className="h-5 w-5" />
            Summary Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-2">
                <FaFileAlt className="h-6 w-6 text-blue-500" />
                {filteredSubmissions.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Submissions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-2">
                <FaChartLine className="h-6 w-6 text-green-500" />
                {averageSolvencyRatio.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Average Solvency Ratio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-2">
                <FaShieldAlt className="h-6 w-6 text-emerald-500" />
                {complianceDistribution[0].value}
              </div>
              <div className="text-sm text-muted-foreground">Compliant Submissions</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
