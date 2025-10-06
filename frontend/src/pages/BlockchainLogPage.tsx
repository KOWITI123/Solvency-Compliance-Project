import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Hash, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText, 
  RefreshCw,
  Search,
  Filter,
  Download,
  Eye,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface BlockchainEntry {
  id: number;
  data_hash: string;
  capital: number;
  liabilities: number;
  solvency_ratio: number;
  status: string;
  insurer_submitted_at: string;
  regulator_processed_at?: string;
  regulator_comments?: string;
  insurer_id: number;
}

interface BlockchainStats {
  totalTransactions: number;
  approvedTransactions: number;
  rejectedTransactions: number;
  pendingTransactions: number;
  averageSolvencyRatio: number;
}

export function BlockchainLogPage() {
  const [submissions, setSubmissions] = useState<BlockchainEntry[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<BlockchainEntry[]>([]);
  const [stats, setStats] = useState<BlockchainStats>({
    totalTransactions: 0,
    approvedTransactions: 0,
    rejectedTransactions: 0,
    pendingTransactions: 0,
    averageSolvencyRatio: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState<BlockchainEntry | null>(null);

  // ✅ FETCH DATA FROM EXISTING SUBMISSIONS ENDPOINT
  const fetchBlockchainData = async () => {
    try {
      console.log('🔗 Fetching blockchain data from submissions...');
      
      const response = await fetch('http://localhost:5000/api/submissions');
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Submissions data:', data);
        
        const submissionData = data.submissions || [];
        setSubmissions(submissionData);
        
        // Calculate stats
        const approved = submissionData.filter((sub: BlockchainEntry) => 
          sub.status === 'REGULATOR_APPROVED'
        ).length;
        
        const rejected = submissionData.filter((sub: BlockchainEntry) => 
          sub.status === 'REJECTED'
        ).length;
        
        const pending = submissionData.filter((sub: BlockchainEntry) => 
          sub.status === 'INSURER_SUBMITTED'
        ).length;
        
        const avgSolvency = submissionData.length > 0 ? 
          submissionData.reduce((sum: number, sub: BlockchainEntry) => sum + (sub.solvency_ratio || 0), 0) / submissionData.length : 0;
        
        setStats({
          totalTransactions: submissionData.length,
          approvedTransactions: approved,
          rejectedTransactions: rejected,
          pendingTransactions: pending,
          averageSolvencyRatio: Math.round(avgSolvency)
        });
      } else {
        console.error('Failed to fetch submissions:', response.status);
        setSubmissions([]);
      }
    } catch (error) {
      console.error('Error fetching blockchain data:', error);
      setSubmissions([]);
      toast.error('Failed to fetch blockchain data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FILTER SUBMISSIONS
  useEffect(() => {
    let filtered = submissions;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(sub => 
        sub.data_hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.insurer_id.toString().includes(searchTerm) ||
        (sub.regulator_comments || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sub => sub.status === statusFilter);
    }

    // Sort by submission date (most recent first)
    filtered.sort((a, b) => 
      new Date(b.insurer_submitted_at).getTime() - new Date(a.insurer_submitted_at).getTime()
    );

    setFilteredSubmissions(filtered);
  }, [submissions, searchTerm, statusFilter]);

  // ✅ AUTO-REFRESH EVERY 30 SECONDS
  useEffect(() => {
    fetchBlockchainData();
    
    const interval = setInterval(fetchBlockchainData, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ GET STATUS BADGE
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'INSURER_SUBMITTED': { 
        variant: 'outline' as const, 
        className: 'bg-blue-100 text-blue-800', 
        label: 'SUBMITTED',
        icon: FileText
      },
      'REGULATOR_APPROVED': { 
        variant: 'default' as const, 
        className: 'bg-green-100 text-green-800', 
        label: 'APPROVED',
        icon: CheckCircle
      },
      'REJECTED': { 
        variant: 'destructive' as const, 
        className: 'bg-red-100 text-red-800', 
        label: 'REJECTED',
        icon: XCircle
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.INSURER_SUBMITTED;
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <IconComponent className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // ✅ GENERATE BLOCKCHAIN HASH (simulated from data hash)
  const generateBlockchainHash = (dataHash: string, type: 'submission' | 'approval' | 'rejection') => {
    const prefix = type === 'submission' ? '0x1' : type === 'approval' ? '0x2' : '0x3';
    return `${prefix}${dataHash.substring(2, 42)}`;
  };

  // ✅ EXPORT FUNCTIONALITY
  const exportData = (format: 'csv' | 'json') => {
    const dataStr = format === 'json' 
      ? JSON.stringify(filteredSubmissions, null, 2)
      : generateCSV(filteredSubmissions);
    
    const dataBlob = new Blob([dataStr], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blockchain-log-${new Date().toISOString().split('T')[0]}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Blockchain log exported as ${format.toUpperCase()}`);
  };

  const generateCSV = (data: BlockchainEntry[]) => {
    const headers = [
      'Data Hash', 'Status', 'Insurer ID', 'Capital', 'Liabilities', 
      'Solvency Ratio', 'Submitted At', 'Processed At', 'Comments'
    ];
    
    const rows = data.map(sub => [
      sub.data_hash,
      sub.status,
      sub.insurer_id,
      sub.capital,
      sub.liabilities,
      sub.solvency_ratio,
      sub.insurer_submitted_at,
      sub.regulator_processed_at || 'Not processed',
      sub.regulator_comments || 'No comments'
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Loading blockchain data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Hash className="h-8 w-8" />
            Blockchain Transaction Log
          </h1>
          <p className="text-muted-foreground">
            Immutable audit trail of all solvency compliance transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchBlockchainData}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => exportData('csv')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportData('json')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">On blockchain</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approvedTransactions}</div>
            <p className="text-xs text-muted-foreground">Regulator approved</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejectedTransactions}</div>
            <p className="text-xs text-muted-foreground">Regulator rejected</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingTransactions}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Solvency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageSolvencyRatio}%</div>
            <p className="text-xs text-muted-foreground">Across all submissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Blockchain Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by hash, insurer ID, or comments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="INSURER_SUBMITTED">Submitted</SelectItem>
                <SelectItem value="REGULATOR_APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Blockchain Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Blockchain Transaction History ({filteredSubmissions.length})</span>
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              Last updated: {new Date().toLocaleTimeString()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction Hash</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Insurer</TableHead>
                    <TableHead>Financial Data</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Hash className="h-3 w-3" />
                            <code className="bg-gray-100 px-1 rounded">
                              {generateBlockchainHash(submission.data_hash, 'submission').substring(0, 20)}...
                            </code>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Data: {submission.data_hash.substring(0, 16)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(submission.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-3 w-3" />
                          <span className="font-medium">INS-{submission.insurer_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span>Capital:</span>
                            <span className="font-medium text-green-600">
                              KES {submission.capital.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Liabilities:</span>
                            <span className="font-medium text-red-600">
                              KES {submission.liabilities.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Solvency:</span>
                            <span className={`font-bold ${submission.solvency_ratio >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                              {submission.solvency_ratio}%
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {format(new Date(submission.insurer_submitted_at), 'MMM dd, HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {submission.regulator_processed_at ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            {format(new Date(submission.regulator_processed_at), 'MMM dd, HH:mm')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSubmission(submission)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Hash className="mx-auto h-12 w-12 mb-4" />
              <p>No blockchain transactions found matching your filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Blockchain Transaction Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSubmission(null)}
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-6">
                {/* Transaction Hashes */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Blockchain Transaction Hash</label>
                    <p className="font-mono text-xs bg-blue-50 p-3 rounded border break-all">
                      {generateBlockchainHash(selectedSubmission.data_hash, 'submission')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Data Hash (SHA-256)</label>
                    <p className="font-mono text-xs bg-gray-100 p-3 rounded border break-all">
                      {selectedSubmission.data_hash}
                    </p>
                  </div>
                </div>
                
                {/* Status and Insurer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Transaction Status</label>
                    <div className="mt-1">{getStatusBadge(selectedSubmission.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Insurer ID</label>
                    <p className="font-medium flex items-center gap-2 mt-1">
                      <Building className="h-4 w-4" />
                      INS-{selectedSubmission.insurer_id}
                    </p>
                  </div>
                </div>
                
                {/* Financial Data */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded border">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Capital</label>
                    <p className="font-bold text-green-600 text-lg">
                      KES {selectedSubmission.capital.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Liabilities</label>
                    <p className="font-bold text-red-600 text-lg">
                      KES {selectedSubmission.liabilities.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Solvency Ratio</label>
                    <p className={`font-bold text-xl ${selectedSubmission.solvency_ratio >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedSubmission.solvency_ratio}%
                    </p>
                  </div>
                </div>
                
                {/* Timeline */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Transaction Timeline</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-blue-50 rounded">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">Submitted by Insurer</p>
                        <p className="text-xs text-gray-600">
                          {format(new Date(selectedSubmission.insurer_submitted_at), 'PPP pp')}
                        </p>
                      </div>
                    </div>
                    
                    {selectedSubmission.regulator_processed_at && (
                      <div className={`flex items-center gap-3 p-2 rounded ${
                        selectedSubmission.status === 'REGULATOR_APPROVED' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        {selectedSubmission.status === 'REGULATOR_APPROVED' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {selectedSubmission.status === 'REGULATOR_APPROVED' ? 'Approved' : 'Rejected'} by Regulator
                          </p>
                          <p className="text-xs text-gray-600">
                            {format(new Date(selectedSubmission.regulator_processed_at), 'PPP pp')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Regulator Comments */}
                {selectedSubmission.regulator_comments && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Regulator Comments</label>
                    <p className="p-3 bg-gray-50 rounded border mt-1">
                      {selectedSubmission.regulator_comments}
                    </p>
                  </div>
                )}
                
                {/* Block Information (Simulated) */}
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 border-t pt-4">
                  <div>
                    <span className="font-medium">Block Number:</span> #{selectedSubmission.id + 1000}
                  </div>
                  <div>
                    <span className="font-medium">Gas Used:</span> 21,000 wei
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}