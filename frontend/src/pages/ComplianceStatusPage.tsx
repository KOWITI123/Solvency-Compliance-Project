import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ComplianceBadge } from '@/components/shared/ComplianceBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, ExternalLink, FileText, ShieldAlert, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const IRA_GENERAL_THRESHOLD = 400_000_000;
const formatCurrency = (value: number) => `KES ${value.toLocaleString()}`;

interface UserComplianceStatus {
  capital: number;
  liabilities: number;
  solvency_ratio: number;
  status: string;
  submission_date: string;
  regulator_approved_at: string | null;
  regulator_comments: string | null;
}

export function ComplianceStatusPage() {
  const [latestStatus, setLatestStatus] = useState<UserComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ✅ GET CURRENT USER AND FETCH THEIR COMPLIANCE DATA
  useEffect(() => {
    const fetchUserComplianceStatus = async () => {
      try {
        // Get current user from localStorage
        const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userId = userData.id;
        
        console.log('👤 Current user in ComplianceStatusPage:', userData);
        console.log('🆔 User ID:', userId);
        
        setCurrentUser(userData);
        
        if (!userId) {
          console.error('❌ No user ID found');
          setLoading(false);
          return;
        }

        // ✅ FETCH USER-SPECIFIC SUBMISSIONS
        const response = await fetch(`http://localhost:5000/api/submissions/user/${userId}`);
        
        if (!response.ok) {
          console.error('Failed to fetch user submissions:', response.status);
          setLoading(false);
          return;
        }

        const data = await response.json();
        console.log('📊 User submissions data:', data);
        
        if (data.success && data.submissions && data.submissions.length > 0) {
          // Get the most recent APPROVED submission
          const approvedSubmissions = data.submissions.filter(
            (sub: any) => sub.status === 'REGULATOR_APPROVED' && sub.solvency_ratio !== null
          );
          
          if (approvedSubmissions.length > 0) {
            // Sort by approval date and get the latest
            const latest = approvedSubmissions.sort((a: any, b: any) => 
              new Date(b.regulator_approved_at).getTime() - new Date(a.regulator_approved_at).getTime()
            )[0];
            
            // ✅ CALCULATE COMPLIANCE STATUS
            const solvencyRatio = latest.solvency_ratio / 100; // Convert percentage to ratio
            const isCapitalCompliant = latest.capital >= IRA_GENERAL_THRESHOLD;
            const isSolvencyCompliant = solvencyRatio >= 1.0;
            const isCompliant = isCapitalCompliant && isSolvencyCompliant;
            
            setLatestStatus({
              capital: latest.capital,
              liabilities: latest.liabilities,
              solvency_ratio: solvencyRatio,
              status: isCompliant ? 'Compliant' : 'Non-Compliant',
              submission_date: latest.submission_date,
              regulator_approved_at: latest.regulator_approved_at,
              regulator_comments: latest.regulator_comments
            });
            
            console.log('✅ Latest approved submission for user:', latest);
          } else {
            console.log('ℹ️ No approved submissions found for user');
            setLatestStatus(null);
          }
        } else {
          console.log('ℹ️ No submissions found for user');
          setLatestStatus(null);
        }
        
      } catch (error) {
        console.error('❌ Error fetching compliance status:', error);
        toast.error('Failed to load compliance status');
      } finally {
        setLoading(false);
      }
    };

    fetchUserComplianceStatus();
  }, []);

  // ✅ LOADING STATE
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Fetching your compliance status...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // ✅ NO DATA STATE
  if (!latestStatus) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle>No Approved Data Available</CardTitle>
            <CardDescription>
              You haven't had any financial data approved yet. Please submit your data and wait for regulator approval to see your compliance status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button asChild>
                <Link to="/app/data-input">Submit Financial Data</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app/blockchain-log">View Submission History</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompliant = latestStatus.status === 'Compliant';
  const lastCheckDate = latestStatus.regulator_approved_at || latestStatus.submission_date;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Compliance Status</h1>
        <p className="text-lg text-muted-foreground">
          {currentUser?.business_name || currentUser?.username}'s solvency compliance status based on data approved on {format(new Date(lastCheckDate), 'PPP')}.
        </p>
      </div>

      <Alert variant={isCompliant ? 'default' : 'destructive'} className={isCompliant ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800" : ""}>
        {isCompliant ? <CheckCircle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        <AlertTitle className="text-lg font-semibold">
          You are currently {latestStatus.status}
        </AlertTitle>
        <AlertDescription>
          {isCompliant
            ? 'Your capital and solvency ratio meet the IRA requirements.'
            : 'Your capital or solvency ratio does not meet the IRA requirements. Please review the details below.'}
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Solvency Ratio</CardTitle>
            <CardDescription>Capital / Liabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-5xl font-bold ${latestStatus.solvency_ratio >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
              {latestStatus.solvency_ratio.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">IRA Threshold: ≥ 1.0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capital</CardTitle>
            <CardDescription>Your reported capital</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${latestStatus.capital >= IRA_GENERAL_THRESHOLD ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(latestStatus.capital)}
            </p>
            <p className="text-sm text-muted-foreground">IRA Threshold: ≥ {formatCurrency(IRA_GENERAL_THRESHOLD)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liabilities</CardTitle>
            <CardDescription>Your reported liabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(latestStatus.liabilities)}
            </p>
            <p className="text-sm text-muted-foreground">&nbsp;</p>
          </CardContent>
        </Card>
      </div>

      {/* Show regulator comments if available */}
      {latestStatus.regulator_comments && (
        <Card>
          <CardHeader>
            <CardTitle>Regulator Comments</CardTitle>
            <CardDescription>Latest feedback from regulatory approval</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{latestStatus.regulator_comments}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        <Button asChild>
          <Link to="/app/blockchain-log">
            <FileText className="mr-2 h-4 w-4" /> View Blockchain Log
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/app/dashboard">
            <TrendingUp className="mr-2 h-4 w-4" /> Analyze Trends
          </Link>
        </Button>
      </div>
    </div>
  );
}