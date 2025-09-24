import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubmissions, useIsLoadingData } from '@/stores/dataStore';
import { Submission } from '@/lib/types';
import { format } from 'date-fns';
import { ComplianceBadge } from '@/components/shared/ComplianceBadge';
import { ExternalLink } from 'lucide-react';
import { DataTableSkeleton } from '@/components/shared/DataTableSkeleton';
const formatCurrency = (value: number) => `KES ${value.toLocaleString()}`;
export function BlockchainLogPage() {
  const submissions = useSubmissions();
  const isLoading = useIsLoadingData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      const searchMatch =
        format(new Date(submission.date), 'PPP').toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.transactionHash.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = statusFilter === 'all' || submission.status === statusFilter;
      return searchMatch && statusMatch;
    });
  }, [submissions, searchTerm, statusFilter]);
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Blockchain Log</h1>
        <p className="text-lg text-muted-foreground">
          A detailed, immutable record of all financial data submissions.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search by date or hash..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
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
      {isLoading ? (
        <DataTableSkeleton columns={6} />
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Capital (KES)</TableHead>
                  <TableHead>Liabilities (KES)</TableHead>
                  <TableHead>Solvency Ratio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission: Submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>{format(new Date(submission.date), 'PPP')}</TableCell>
                    <TableCell>{formatCurrency(submission.capital)}</TableCell>
                    <TableCell>{formatCurrency(submission.liabilities)}</TableCell>
                    <TableCell>{submission.solvencyRatio.toFixed(2)}</TableCell>
                    <TableCell>
                      <ComplianceBadge status={submission.status} />
                    </TableCell>
                    <TableCell>
                      <a
                        href="#"
                        className="flex items-center gap-2 text-blue-500 hover:underline"
                        title={submission.transactionHash}
                      >
                        {`${submission.transactionHash.substring(0, 10)}...`}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredSubmissions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No logs match your criteria.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}