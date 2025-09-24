import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubmissions, useLatestComplianceStatus } from '@/stores/dataStore';
import { StatCard } from '@/components/shared/StatCard';
import { DollarSign, FileText, Percent, Download } from 'lucide-react';
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
  const filteredSubmissions = allSubmissions
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-parseInt(timeRange));
  const chartData = filteredSubmissions.map(s => ({
    date: format(new Date(s.date), 'yyyy-MM-dd'),
    solvencyRatio: s.solvencyRatio,
    capital: s.capital,
    liabilities: s.liabilities,
    status: s.status,
  }));
  const complianceDistribution = filteredSubmissions.reduce((acc, s) => {
    if (s.status === 'Compliant') acc[0].value += 1;
    else acc[1].value += 1;
    return acc;
  }, [
    { name: 'Compliant', value: 0 },
    { name: 'Non-Compliant', value: 0 },
  ]);
  const averageSolvencyRatio = filteredSubmissions.length > 0
    ? filteredSubmissions.reduce((sum, s) => sum + s.solvencyRatio, 0) / filteredSubmissions.length
    : 0;
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
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Insurer Dashboard</h1>
          <p className="text-lg text-muted-foreground">Your compliance trends at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Average Solvency Ratio"
          value={averageSolvencyRatio.toFixed(2)}
          icon={<Percent className="h-5 w-5" />}
          description={`Over the last ${timeRange} days`}
        />
        <StatCard
          title="Total Submissions"
          value={filteredSubmissions.length}
          icon={<FileText className="h-5 w-5" />}
          description={`In the last ${timeRange} days`}
        />
        <StatCard
          title="Latest Capital"
          value={`KES ${latestStatus ? (latestStatus.capital / 1_000_000).toFixed(1) : 'N/A'}M`}
          icon={<DollarSign className="h-5 w-5" />}
          description={latestStatus ? `As of ${format(new Date(latestStatus.lastCheck), 'PPP')}` : ''}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Solvency Ratio Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.map(d => ({ ...d, date: format(new Date(d.date), 'MMM d') }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="solvencyRatio" name="Solvency Ratio" stroke={COLORS.capital} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Capital vs. Liabilities (in KES Millions)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.map(d => ({ ...d, date: format(new Date(d.date), 'MMM d'), capital: d.capital / 1_000_000, liabilities: d.liabilities / 1_000_000 }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="capital" name="Capital" fill={COLORS.capital} />
                <Bar dataKey="liabilities" name="Liabilities" fill={COLORS.liabilities} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Compliance Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={complianceDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                <Cell key="compliant" fill={COLORS.compliant} />
                <Cell key="non-compliant" fill={COLORS.nonCompliant} />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}