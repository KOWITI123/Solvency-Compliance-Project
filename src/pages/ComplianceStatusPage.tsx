import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ComplianceBadge } from '@/components/shared/ComplianceBadge';
import { useLatestComplianceStatus } from '@/stores/dataStore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, ExternalLink, FileText, ShieldAlert, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
const IRA_GENERAL_THRESHOLD = 400_000_000;
const formatCurrency = (value: number) => `KES ${value.toLocaleString()}`;
export function ComplianceStatusPage() {
  const latestStatus = useLatestComplianceStatus();
  if (!latestStatus) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
            <CardDescription>
              You haven't submitted any financial data yet. Please submit your data to see your compliance status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/app/data-input">Input Data Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  const isCompliant = latestStatus.status === 'Compliant';
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Compliance Status</h1>
        <p className="text-lg text-muted-foreground">
          An overview of your solvency based on the latest data from {format(new Date(latestStatus.lastCheck), 'PPP')}.
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
            <p className={`text-5xl font-bold ${latestStatus.solvencyRatio >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
              {latestStatus.solvencyRatio.toFixed(2)}
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
      <Card>
        <CardHeader>
          <CardTitle>Recent SMS Alerts</CardTitle>
          <CardDescription>Mock alerts based on your status.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-red-500"><ShieldAlert className="h-4 w-4" /></span>
              <span>Non-Compliant: Capital below KES 400M, sent 07/09/2025</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500"><CheckCircle className="h-4 w-4" /></span>
              <span>Compliant: Status restored, sent 02/09/2025</span>
            </li>
          </ul>
        </CardContent>
      </Card>
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