import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// ✅ ADD: Missing import
import { RefreshCw } from 'lucide-react';
// Lightweight local toast fallback to avoid depending on 'react-hot-toast' in this repo.
// This provides the same .success/.error/.warning API used in this file.
// It logs to the console and uses alert for error/warning so user sees important messages.
// Replace with your preferred toast library later if desired.
const toast: any = {
  success: (msg: any, opts?: any) => {
    try {
      console.info('Toast success:', msg, opts);
    } catch (e) {
      /* ignore */
    }
  },
  error: (msg: any, opts?: any) => {
    try {
      console.error('Toast error:', msg, opts);
      if (typeof window !== 'undefined') {
        alert(typeof msg === 'string' ? msg : (opts?.description || JSON.stringify(msg)));
      }
    } catch (e) {
      /* ignore */
    }
  },
  warning: (msg: any, opts?: any) => {
    try {
      console.warn('Toast warning:', msg, opts);
      if (typeof window !== 'undefined') {
        alert(typeof msg === 'string' ? msg : (opts?.description || JSON.stringify(msg)));
      }
    } catch (e) {
      /* ignore */
    }
  }
};

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

  // Material risks state for insurer dashboard
  const [materialRisks, setMaterialRisks] = useState<any[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);

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

const normalizeStatus = (s: any) => {
  if (!s && s !== '') return null;
  const up = String(s).toUpperCase();
  if (up.includes('REJECT')) return 'REGULATOR_REJECTED';
  if (up.includes('APPROV')) return 'REGULATOR_APPROVED';
  if (up.includes('INSURER') || up.includes('SUBMIT')) return 'INSURER_SUBMITTED';
  return up;
};

// ✅ HANDLE: The actual API response format (normalize statuses)
if (data.success && data.submissions) {
  const submissions = data.submissions.map((submission: any) => ({
    ...submission,
    submission_date: submission.submission_date || submission.created_at,
    status: normalizeStatus(submission.status)
  }));
 
           setSubmissionHistory(submissions);
           console.log(`✅ Found ${submissions.filter((s:any)=>s.status==='REGULATOR_APPROVED').length} approved submissions and ${submissions.filter((s:any)=>s.status==='REGULATOR_REJECTED').length} rejected submissions`);
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
    else if (s.status === 'REGULATOR_REJECTED') acc[1].value += 1;
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

  // Compute the latest regulator decision (approved or rejected)
  const userLatestStatus = (() => {
    if (!submissionHistory || submissionHistory.length === 0) return null;

    const withAction = submissionHistory
      .map((s: any) => {
        const approvedAt = s.regulator_approved_at ? new Date(s.regulator_approved_at) : null;
        const rejectedAt = s.regulator_rejected_at ? new Date(s.regulator_rejected_at) : null;
        const actionDate =
          approvedAt && rejectedAt ? (approvedAt > rejectedAt ? approvedAt : rejectedAt) : (approvedAt || rejectedAt);
        return { ...s, _actionDate: actionDate };
      })
      .filter((s: any) => s._actionDate);

    if (withAction.length === 0) return null;
    withAction.sort((a: any, b: any) => (b._actionDate as Date).getTime() - (a._actionDate as Date).getTime());
    return withAction[0];
  })();

  console.log('📊 Latest regulator decision:', userLatestStatus);

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

  const creditScoreToGrade = (score: number) => {
    // score: percentage where higher = greater credit risk exposure
    // Lower score => better credit rating. Tunable thresholds:
    if (score <= 5) return 'A+';
    if (score <= 10) return 'A';
    if (score <= 20) return 'A-';
    if (score <= 30) return 'B';
    if (score <= 50) return 'C';
    return 'D';
  };

  const fetchMaterialRisks = useCallback(async () => {
    try {
      // Prefer authenticated user id from auth store; fallback to localStorage for legacy sessions
      const currentUserLS = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userId = user?.id ?? (user as any)?.userId ?? currentUserLS.id;
      if (!userId) {
        console.warn('InsurerDashboard: no user id available to fetch risks');
        setMaterialRisks([]);
        return;
      }
      setRisksLoading(true);
      const resp = await fetch(`http://localhost:5000/api/insurer/${userId}/risks`);
      if (!resp.ok) {
        console.warn('InsurerDashboard: fetch risks returned non-ok', resp.status);
        setMaterialRisks([]);
        return;
      }
      const data = await resp.json();
      setMaterialRisks(data.risks || []);
      console.debug('InsurerDashboard: fetched material risks', (data.risks || []).length);
    } catch (e) {
      console.error('Failed fetching insurer risks', e);
      setMaterialRisks([]);
    } finally {
      setRisksLoading(false);
    }
  }, [user]);
 
   useEffect(() => {
     // initial load
     fetchMaterialRisks();
    // listen for in-page event
    const handler = () => { fetchMaterialRisks(); };
    window.addEventListener('risks-updated', handler);

    // listen for cross-tab storage events
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === 'risks-updated') fetchMaterialRisks();
    };
    window.addEventListener('storage', storageHandler);

    // listen for BroadcastChannel messages (if available)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('risks-channel');
      bc.onmessage = (m) => {
        try {
          if (!m || !m.data) return;
          // optionally inspect m.data.insurer_id to filter
          fetchMaterialRisks();
        } catch (e: any) {
          // Log handler errors to help debugging without interrupting the UI.
          console.error('InsurerDashboard: error in BroadcastChannel onmessage handler', e);
        }
      };
    } catch (e: any) {
      // BroadcastChannel may be unavailable (SSR or older browsers) — log and continue.
      console.warn('InsurerDashboard: BroadcastChannel not available or failed to initialize', e);
    }

    return () => {
      window.removeEventListener('risks-updated', handler);
      window.removeEventListener('storage', storageHandler);
      if (bc) {
        try { bc.close(); } catch (e) { console.warn('InsurerDashboard: failed to close BroadcastChannel', e); }
      }
    };
   }, [fetchMaterialRisks, user]);

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

      {/* Show latest regulator decision (approved or rejected) */}
      {userLatestStatus && (
        (() => {
          const isApproved = Boolean(userLatestStatus.regulator_approved_at);
          const isRejected = Boolean(userLatestStatus.regulator_rejected_at);
          const cardClass = isApproved
            ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50'
            : isRejected
            ? 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50'
            : 'border-gray-200 bg-gray-50';
          const badgeText = isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Decision';
          const badgeClass = isApproved ? 'bg-green-100 text-green-800' : isRejected ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
          const actionDate = userLatestStatus.regulator_approved_at || userLatestStatus.regulator_rejected_at;

          return (
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isApproved ? 'text-green-800' : isRejected ? 'text-red-800' : ''}`}>
                  {isApproved ? <FaCheck className="h-5 w-5" /> : isRejected ? <FaTimes className="h-5 w-5" /> : <FaChartBar className="h-5 w-5" />}
                  Latest Regulatory Decision
                  <Badge variant="secondary" className={badgeClass}>
                    {badgeText}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`space-y-2 ${isApproved ? 'text-green-800' : isRejected ? 'text-red-800' : ''}`}>
                    <div className="text-sm font-medium">Transaction #{userLatestStatus.id}</div>
                    <div className="text-sm">
                      {isApproved ? 'Approved:' : isRejected ? 'Rejected:' : 'Decision:'} {actionDate ? format(new Date(actionDate), 'PPP pp') : '—'}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Capital:</span>
                        <div className="font-medium">KES {userLatestStatus.capital?.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Liabilities:</span>
                        <div className="font-medium">KES {userLatestStatus.liabilities?.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Solvency:</span>
                        <div className="font-medium">{userLatestStatus.solvency_ratio}%</div>
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
          );
        })()
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
                          submission.status === 'REGULATOR_REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {submission.status === 'REGULATOR_APPROVED' ? 'Approved' :
                           submission.status === 'REGULATOR_REJECTED' ? 'Rejected' : 'Pending'}
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
                      {submission.status === 'REGULATOR_REJECTED' && submission.regulator_rejected_at && (
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

      {/* Material Risks section (new, read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Material Risks</CardTitle>
          <CardDescription>Active material risks for your company</CardDescription>
        </CardHeader>
        <CardContent>
          {risksLoading ? (
            <div>Loading risks...</div>
          ) : materialRisks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active risks recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Score (%)</TableHead>
                  <TableHead>Credit Grade</TableHead>
                  <TableHead>Last Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialRisks.map((r) => {
                  const score = Number(r.risk_score || 0);
                  // Prefer server-provided credit_grade if available, otherwise compute locally
                  const grade = (r.credit_grade && String(r.credit_grade).trim()) ? String(r.credit_grade) : creditScoreToGrade(score);
                   return (
                     <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.risk_title || 'Untitled risk'}</TableCell>
                      <TableCell>{score.toFixed(2)}%</TableCell>
                      <TableCell>
                        <Badge className={(grade || '').startsWith('A') ? 'bg-green-100 text-green-800' : grade === 'B' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                          {grade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.last_reviewed || 'N/A'}</TableCell>
                     </TableRow>
                   );
                 })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
