import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubmissions } from '@/stores/dataStore';
import { format } from 'date-fns';
import { ComplianceBadge } from '@/components/shared/ComplianceBadge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
const COLORS = {
  compliant: 'hsl(var(--chart-2))',
  nonCompliant: 'hsl(var(--chart-5))'
};
export function AuditDashboardPage() {
  const allSubmissions = useSubmissions();
  const [insurerIdFilter, setInsurerIdFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const anonymizedData = useMemo(() => {
    return allSubmissions.map((s, i) => ({
      ...s,
      insurerId: `INS-${(s.id.charCodeAt(s.id.length - 1) % 5) + 101}` // Consistent anonymization
    }));
  }, [allSubmissions]);
  const filteredData = useMemo(() => {
    return anonymizedData.filter((s) => {
      const insurerMatch = insurerIdFilter === 'all' || s.insurerId === insurerIdFilter;
      const statusMatch = statusFilter === 'all' || s.status === statusFilter;
      return insurerMatch && statusMatch;
    });
  }, [anonymizedData, insurerIdFilter, statusFilter]);
  const complianceDistribution = useMemo(() => {
    return filteredData.reduce((acc, s) => {
      if (s.status === 'Compliant') acc[0].value += 1;
      else acc[1].value += 1;
      return acc;
    }, [
      { name: 'Compliant', value: 0 },
      { name: 'Non-Compliant', value: 0 }
    ]);
  }, [filteredData]);
  const averageSolvencyRatio = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const total = filteredData.reduce((sum, s) => sum + s.solvencyRatio, 0);
    return total / filteredData.length;
  }, [filteredData]);
  const uniqueInsurerIds = useMemo(() => [...new Set(anonymizedData.map((s) => s.insurerId))].sort(), [anonymizedData]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Insurer ID', 'Date', 'Status', 'Solvency Ratio'];
    const csvRows = [
      headers.join(','),
      ...filteredData.map(row => [
        `"${row.insurerId}"`,
        `"${format(new Date(row.date), 'yyyy-MM-dd')}"`,
        `"${row.status}"`,
        row.solvencyRatio.toFixed(2)
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Audit Dashboard</h1>
          <p className="text-lg text-muted-foreground">Aggregated compliance data for all insurers.</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={complianceDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  <Cell key="compliant" fill={COLORS.compliant} />
                  <Cell key="non-compliant" fill={COLORS.nonCompliant} />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Solvency Ratio</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[250px]">
            <p className="text-6xl font-bold text-primary">{averageSolvencyRatio.toFixed(2)}</p>
            <p className="text-muted-foreground">Across all filtered submissions</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Insurer Submissions</CardTitle>
          <CardDescription>Read-only, anonymized submission data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <Select value={insurerIdFilter} onValueChange={setInsurerIdFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Insurer ID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Insurers</SelectItem>
                {uniqueInsurerIds.map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}
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
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insurer ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Solvency Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((submission) =>
                  <TableRow key={submission.id}>
                    <TableCell>{submission.insurerId}</TableCell>
                    <TableCell>{format(new Date(submission.date), 'PPP')}</TableCell>
                    <TableCell><ComplianceBadge status={submission.status} /></TableCell>
                    <TableCell>{submission.solvencyRatio.toFixed(2)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 &&
            <div className="text-center py-12 text-muted-foreground">
              <p>No data matches your criteria.</p>
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}