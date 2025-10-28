import React, { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CalendarIcon, 
  Hash, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Database,
  Lock,
  Clock,
  Eye,
  Brain,
  X,
  FileText,
  CloudUpload,
  Upload,
  FileCheck,
  Edit3,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDataStore } from '@/stores/dataStore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ✅ FIXED: Remove the refine validation from schema - we'll handle it in the submit function
const dataInputSchema = z.object({
  capital: z.string().optional(),
  liabilities: z.string().optional(),
  date: z.date().optional(),
  // P&L / Profitability & Efficiency
  gwp: z.string().optional(),
  net_claims_paid: z.string().optional(),
  investment_income_total: z.string().optional(),
  commission_expense_total: z.string().optional(),
  operating_expenses_total: z.string().optional(),
  profit_before_tax: z.string().optional(),
  // Regulatory & Governance disclosures
  contingency_reserve_statutory: z.string().optional(),
  ibnr_reserve_gross: z.string().optional(),
  irfs17_implementation_status: z.string().optional(),
  related_party_net_exposure: z.string().optional(),
  claims_development_method: z.string().optional(),
  auditors_unqualified_opinion: z.boolean().optional(),
});

type DataInputFormValues = z.infer<typeof dataInputSchema>;

interface ComplianceMetrics {
  car?: number;
  required_capital?: number;
  available_capital?: number;
  asset_adequacy?: boolean | string;
  insurance_service_result?: number;
  insurance_revenue_growth?: number;
  insurance_liabilities_adequacy?: boolean | string;
  reinsurance_strategy?: string;
  claims_development?: string;
  internal_controls?: string;
  board_structure?: string;
  board_committee_oversight?: string;
  related_party_transactions?: string;
  investment_policy_submission?: string;
}

interface BlockchainSubmissionResult {
  success: boolean;
  data_hash: string;
  transaction_id: number;
  message: string;
  status: string;
  capital: number;
  liabilities: number;
  submission_date: string;
  ai_extraction?: ComplianceMetrics | null;
  error?: string;
}

// ✅ Standalone File Upload Component
function StandaloneFileUpload({ 
  onFileSelect, 
  selectedFile, 
  onClearFile, 
  disabled 
}: {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  disabled: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isLargeFile = selectedFile && selectedFile.size > 50 * 1024 * 1024;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Upload Financial Statement</label>
        <Badge variant="secondary" className="text-xs">Optional</Badge>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.doc,.docx,.txt"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
        aria-label="File upload input"
      />
      
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
            isDragOver ? "border-blue-400 bg-blue-50 border-solid" : "border-gray-300 hover:bg-gray-50",
            disabled && "pointer-events-none opacity-50"
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <CloudUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-sm font-medium text-gray-900">
            {isDragOver ? "Drop file here" : "Click to upload or drag & drop"}
          </p>
          <p className="text-xs text-gray-500">
            PDF, Excel, Word, Text documents • Max 100MB
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Upload file for regulator reference and accountability. No automatic AI scanning will be performed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-green-800 font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-green-600">
                {formatFileSize(selectedFile.size)} • Uploaded for regulator review (no automatic AI scanning)
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFile}
              disabled={disabled}
              className="h-8 w-8 p-0 flex-shrink-0"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isLargeFile && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Large File Detected</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Processing may take longer. Ensure stable internet connection during upload.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ✅ FIXED: Proper function to get current user's insurer ID
function getCurrentInsurerId(): string {
  const userStorage = localStorage.getItem('user');
  if (userStorage) {
    const user = JSON.parse(userStorage);
    if (user.id) return user.id.toString();
  }
  return '1'; // fallback
}

// ✅ MAIN COMPONENT
const DataInputPage: React.FC = () => {
  // ✅ ADD: Missing state declarations
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<BlockchainSubmissionResult | null>(null);
  const [isSubmissionComplete, setIsSubmissionComplete] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<'file' | 'manual' | 'both'>('both');
  
  const navigate = useNavigate();

  const form = useForm<DataInputFormValues>({
    resolver: zodResolver(dataInputSchema),
    defaultValues: {
      capital: '',
      liabilities: '',
      date: new Date(),
    },
    mode: 'onChange',
  });

  // ✅ FIXED: submitToBlockchain function
  const submitToBlockchain = async (formData: any, file?: File): Promise<BlockchainSubmissionResult> => {
    console.log('🔧 DEBUG: submitToBlockchain called with:', { formData, fileName: file?.name });
    
    try {
      setUploadProgress(20);
      
      // ✅ AUTO-DETECT insurer ID
      const insurerId = getCurrentInsurerId();
      console.log('🔧 DEBUG: Auto-detected insurer_id:', insurerId);
      
      const submitData = new FormData();
      submitData.append('insurer_id', insurerId);
      console.log('🔧 DEBUG: Added insurer_id:', insurerId);
      
      // Add capital and liabilities (can be empty for AI extraction)
      if (formData.capital) {
        submitData.append('capital', formData.capital.toString());
        console.log('🔧 DEBUG: Added capital:', formData.capital);
      } else {
        submitData.append('capital', '');
        console.log('🔧 DEBUG: Capital empty - expecting AI extraction');
      }
      
      if (formData.liabilities) {
        submitData.append('liabilities', formData.liabilities.toString());
        console.log('🔧 DEBUG: Added liabilities:', formData.liabilities);
      } else {
        submitData.append('liabilities', '');
        console.log('🔧 DEBUG: Liabilities empty - expecting AI extraction');
      }
      
      // Add submission date
      const submissionDate = formData.date ? formData.date.toISOString() : new Date().toISOString();
      submitData.append('submission_date', submissionDate);
      console.log('🔧 DEBUG: Added submission_date:', submissionDate);

      // If a file is uploaded, we do NOT want server-side AI scanning for now.
      // Add a flag so backend skips AI extraction and only stores the file for manual review.
      if (file) {
        submitData.append('no_ai', 'true');
        console.log('🔧 DEBUG: Added no_ai flag to disable server-side AI extraction');
      }
      
      // --- Append new manual fields (P&L / Profitability & Regulatory) ---
      if (formData.gwp) submitData.append('gwp', formData.gwp.toString());
      if (formData.net_claims_paid) submitData.append('net_claims_paid', formData.net_claims_paid.toString());
      if (formData.investment_income_total) submitData.append('investment_income_total', formData.investment_income_total.toString());
      if (formData.commission_expense_total) submitData.append('commission_expense_total', formData.commission_expense_total.toString());
      if (formData.operating_expenses_total) submitData.append('operating_expenses_total', formData.operating_expenses_total.toString());
      if (formData.profit_before_tax) submitData.append('profit_before_tax', formData.profit_before_tax.toString());
      if (formData.contingency_reserve_statutory) submitData.append('contingency_reserve_statutory', formData.contingency_reserve_statutory.toString());
      if (formData.ibnr_reserve_gross) submitData.append('ibnr_reserve_gross', formData.ibnr_reserve_gross.toString());
      if (formData.irfs17_implementation_status) submitData.append('irfs17_implementation_status', formData.irfs17_implementation_status.toString());
      if (formData.related_party_net_exposure) submitData.append('related_party_net_exposure', formData.related_party_net_exposure.toString());
      if (formData.claims_development_method) submitData.append('claims_development_method', formData.claims_development_method.toString());
      if (typeof formData.auditors_unqualified_opinion !== 'undefined') submitData.append('auditors_unqualified_opinion', String(formData.auditors_unqualified_opinion));
    
    // Add file if provided
    if (file) {
      submitData.append('financialStatement', file);
      console.log('🔧 DEBUG: Added file:', file.name, 'Size:', file.size);
      setUploadProgress(40);
    }
    
    // Log all FormData entries
    console.log('🔧 DEBUG: All FormData entries:');
    for (let [key, value] of submitData.entries()) {
      console.log(`  ${key}:`, value instanceof File ? `File(${value.name})` : value);
    }
    
    setUploadProgress(60);
    
    // ✅ ENHANCED: Try multiple API endpoints
    const apiUrls = [
      '/api/submit-data',
      'http://localhost:5000/api/submit-data'
    ];
    
    let response: Response | undefined;
    let lastError: Error | undefined;
    
    for (const url of apiUrls) {
      try {
        console.log('🔧 DEBUG: Trying URL:', url);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        response = await fetch(url, {
          method: 'POST',
          body: submitData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log('🔧 DEBUG: Response from', url, '- status:', response.status);
        if (response.ok || response.status !== 404) {
          break;
        }
      } catch (error) {
        console.error('🔧 DEBUG: Fetch error:', error); // <-- Add this line
        lastError = error as Error;
        continue;
      }
    }
    
    if (!response) {
      throw lastError || new Error('All API endpoints failed');
    }
    
    setUploadProgress(80);
    
    console.log('🔧 DEBUG: Final response status:', response.status);
    console.log('🔧 DEBUG: Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔧 DEBUG: Error response text:', errorText);
      
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || `HTTP ${response.status}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('🔧 DEBUG: Success response:', result);
    setUploadProgress(100);
    
    // ✅ Validate response structure
    if (!result.success) {
      throw new Error(result.error || 'Submission failed - no success flag');
    }
    
    // Check for AI extraction data
    if (result.ai_extraction) {
      console.log('🔧 DEBUG: AI extraction successful!');
      console.log('🔧 DEBUG: AI confidence:', result.ai_extraction.confidence);
    }
    
    const blockchainResult: BlockchainSubmissionResult = {
      success: true,
      data_hash: result.data_hash || 'no-hash',
      transaction_id: result.transaction_id || 0,
      message: result.message || 'Submission successful',
      status: result.status || 'PENDING',
      capital: result.capital || formData.capital || 0,
      liabilities: result.liabilities || formData.liabilities || 0,
      submission_date: result.submission_date || submissionDate,
      ai_extraction: result.ai_extraction || null
    };
    
    console.log('🔧 DEBUG: Returning blockchain result:', blockchainResult);
    return blockchainResult;
    
    } catch (error) {
      console.error('🔧 DEBUG: submitToBlockchain error:', error);
      setUploadProgress(0);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - please try again');
        }
        throw error;
      } else {
        throw new Error(`Unexpected error: ${String(error)}`);
      }
    }
  };

  const onSubmit = async (data: any) => {
    console.log('🔧 DEBUG: onSubmit called with:', data);
    
    try {
      setIsLoading(true);
      setSubmissionResult(null);
      setUploadProgress(0);
      
      console.log('🔧 DEBUG: Starting blockchain submission...');
      
      const blockchainResult = await submitToBlockchain(data, selectedFile);
      
      console.log('🔧 DEBUG: Blockchain submission successful:', blockchainResult);
      setSubmissionResult(blockchainResult);
      setIsSubmissionComplete(true);
      
      // Clear form
      form.reset();
      setSelectedFile(null);
      setUploadProgress(0);
      
      console.log('🔧 DEBUG: Form reset complete');
      
    } catch (error) {
      console.error('🔧 DEBUG: onSubmit error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Submission error:', errorMessage);
      
      // ✅ Show user-friendly error
      setSubmissionResult({
        success: false,
        data_hash: '',
        transaction_id: 0,
        message: errorMessage,
        status: 'ERROR',
        capital: 0,
        liabilities: 0,
        submission_date: '',
        ai_extraction: null,
        error: errorMessage
      });
      
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleNewSubmission = useCallback(() => {
    setSubmissionResult(null);
    setIsSubmissionComplete(false);
    setSelectedFile(null);
    setUploadProgress(0);
    setSubmissionMode('both');
    
    form.reset({
      capital: '',
      liabilities: '',
      date: new Date(),
    });
  }, [form]);

  const handleFileSelection = useCallback((file: File) => {
    const maxSize = 100 * 1024 * 1024;
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (file.size > maxSize) {
      toast.error('File too large (max 100MB)', {
        description: 'Please compress your file or contact support for assistance'
      });
      return;
    }
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Only PDF, Excel, Word, and Text documents are allowed'
      });
      return;
    }
    
    setSelectedFile(file);
    
    const isLarge = file.size > 50 * 1024 * 1024;
    toast.success(`📄 ${file.name} uploaded for regulator review`, {
      description: isLarge ? 'Large file - regulator review may take longer' : 'File saved for manual verification by the regulator'
    });
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    toast.info('File cleared');
  }, []);

  const getStatusStyling = (status: string) => {
    switch (status) {
      case 'REGULATOR_APPROVED':
        return { variant: 'default' as const, className: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' };
      case 'REJECTED':
        return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Rejected' };
      case 'ERROR':
        return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Error' };
      default:
        return { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' };
    }
  };

  // ✅ FIXED: Update button disabled logic
  const isSubmitDisabled = () => {
    const hasFile = !!selectedFile;
    const hasManualData = form.getValues('capital') && form.getValues('liabilities');
    return isLoading || (!hasFile && !hasManualData);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <Database className="h-10 w-10" />
          Submit Financial Data
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Submit your financial data for regulatory review and blockchain verification
        </p>
      </div>

      {/* ✅ Submission Method Selection */}
      {!isSubmissionComplete && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Choose Your Submission Method
            </CardTitle>
            <CardDescription>
              Select how you'd like to submit your financial data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <CloudUpload className="h-6 w-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-blue-900">File Upload for Regulator Reference</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Upload your financial statement so the regulator can manually verify submitted values.
                    </p>
                    <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-800">
                      Recommended • Fast • Accurate
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition-colors">
                <div className="flex items-start gap-3">
                  <Edit3 className="h-6 w-6 text-purple-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-purple-900">Manual Entry</h3>
                    <p className="text-sm text-purple-700 mt-1">
                      Enter your capital and liabilities data manually using the form below.
                    </p>
                    <Badge variant="secondary" className="mt-2 bg-purple-100 text-purple-800">
                      Traditional • Full Control
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                💡 <strong>Pro Tip:</strong> You can use both methods together: upload a file for regulator verification
                and manually adjust the values if needed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {submissionResult && !submissionResult.success && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-6 w-6" />
              Submission Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-white rounded-lg border border-red-200">
              <p className="text-red-800 font-medium">{submissionResult.error || submissionResult.message}</p>
              <div className="mt-3">
                <Button onClick={handleNewSubmission} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Result */}
      {isSubmissionComplete && submissionResult && submissionResult.success && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <CheckCircle className="h-6 w-6" />
              {submissionResult.status === 'REGULATOR_APPROVED' ? 'Submission Approved' : 'Submission Received'}
            </CardTitle>
            <CardDescription>
              {submissionResult.status === 'REGULATOR_APPROVED' 
                ? 'Your submission has been approved by the regulator'
                : 'Your submission is pending regulator approval'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-blue-800">Transaction ID</label>
                <div className="flex items-center gap-2 p-2 bg-white rounded border">
                  <Hash className="h-4 w-4" />
                  <code className="text-xs break-all">{submissionResult.transaction_id}</code>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800">Status</label>
                <div className="mt-1">
                  {(() => {
                    const styling = getStatusStyling(submissionResult.status);
                    const IconComponent = styling.icon;
                    return (
                      <Badge variant={styling.variant} className={styling.className}>
                        <IconComponent className="w-3 h-3 mr-1" />
                        {styling.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Status Messages */}
            {submissionResult.status === 'INSURER_SUBMITTED' && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Awaiting Regulator Review</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Your financial data has been submitted successfully and is being processed. 
                      AI has extracted the data, but detailed results will be shown after regulator approval.
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-yellow-700">
                      <p>• Regulatory review typically takes 24-48 hours</p>
                      <p>• You'll be notified when the review is complete</p>
                      <p>• You can check status anytime in the Status page</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {submissionResult.status === 'REGULATOR_APPROVED' && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-green-900">Approval Complete</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Your submission has been reviewed and approved. All regulatory requirements have been met.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {submissionResult.status === 'REJECTED' && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-red-900">Submission Rejected</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Your submission requires attention. Please review the feedback and resubmit.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 pt-2">
              <Button onClick={handleNewSubmission} variant="outline">
                Submit New Data
              </Button>
              <Button onClick={() => navigate('/app/status')}>
                <Eye className="mr-2 h-4 w-4" />
                View Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Results Display - Only Show After Regulator Approval */}
      {submissionResult?.ai_extraction && submissionResult.status === 'REGULATOR_APPROVED' && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Brain className="h-6 w-6" />
              AI Extraction Results - Regulator Approved
            </CardTitle>
            <CardDescription className="text-green-700">
              Approved results from your uploaded file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 p-4 bg-white rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 flex items-center gap-2">
                Compliance Metrics
              </h4>
              <ul className="text-sm space-y-1">
                <li><b>Capital Adequacy Ratio (CAR):</b> {submissionResult.ai_extraction.car ?? 'N/A'}%</li>
                <li><b>Required Capital:</b> {submissionResult.ai_extraction.required_capital ?? 'N/A'}</li>
                <li><b>Available Capital:</b> {submissionResult.ai_extraction.available_capital ?? 'N/A'}</li>
                <li><b>Asset Adequacy:</b> {submissionResult.ai_extraction.asset_adequacy ?? 'N/A'}</li>
                <li><b>Insurance Service Result:</b> {submissionResult.ai_extraction.insurance_service_result ?? 'N/A'}</li>
                <li><b>Insurance Revenue Growth:</b> {submissionResult.ai_extraction.insurance_revenue_growth ?? 'N/A'}</li>
                <li><b>Adequacy of Insurance Liabilities:</b> {submissionResult.ai_extraction.insurance_liabilities_adequacy ?? 'N/A'}</li>
                <li><b>Reinsurance Strategy & Credit Risk:</b> {submissionResult.ai_extraction.reinsurance_strategy ?? 'N/A'}</li>
                <li><b>Claims Development/Reserving:</b> {submissionResult.ai_extraction.claims_development ?? 'N/A'}</li>
                <li><b>Internal Controls:</b> {submissionResult.ai_extraction.internal_controls ?? 'N/A'}</li>
                <li><b>Board Structure & Independence:</b> {submissionResult.ai_extraction.board_structure ?? 'N/A'}</li>
                <li><b>Board Committee Oversight:</b> {submissionResult.ai_extraction.board_committee_oversight ?? 'N/A'}</li>
                <li><b>Related Party Transactions:</b> {submissionResult.ai_extraction.related_party_transactions ?? 'N/A'}</li>
                <li><b>Investment Policy Submission:</b> {submissionResult.ai_extraction.investment_policy_submission ?? 'N/A'}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Form */}
      {!isSubmissionComplete && (
        <div className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Option 1: File Upload
              </CardTitle>
              <CardDescription>
                Upload your financial statement for regulator reference (manual verification)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StandaloneFileUpload
                onFileSelect={handleFileSelection}
                selectedFile={selectedFile}
                onClearFile={handleClearFile}
                disabled={isLoading}
              />
              
              {selectedFile && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <FileCheck className="h-5 w-5 text-green-600" />
                    <div>
                      <h4 className="font-medium text-green-900">File ready for submission</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Your financial statement has been uploaded and will be available to the regulator for manual verification.
                        You can still manually enter data below if needed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Entry */}
          <Card>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5" />
                    Option 2: Manual Data Entry
                  </CardTitle>
                  <CardDescription>
                    Enter your financial data manually {selectedFile && "(optional - uploaded file will be available for regulator review)"}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="capital"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Capital (KES)
                          <Badge variant="secondary" className="text-xs">
                            {selectedFile ? 'Optional' : 'Required'}
                          </Badge>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder={selectedFile ? "AI will extract from file" : "e.g., 600000000"}
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        {/* ✅ FIXED: Only show error when no file is uploaded */}
                        {!selectedFile && <FormMessage />}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="liabilities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Liabilities (KES)
                          <Badge variant="secondary" className="text-xs">
                            {selectedFile ? 'Optional' : 'Required'}
                          </Badge>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder={selectedFile ? "AI will extract from file" : "e.g., 400000000"}
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        {/* ✅ FIXED: Only show error when no file is uploaded */}
                        {!selectedFile && <FormMessage />}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center gap-2">
                          Submission Date
                          <Badge variant="secondary" className="text-xs">Optional</Badge>
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                disabled={isLoading}
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP') : <span>Pick a date (defaults to today)</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => field.onChange(date)}
                              disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* ---------------- P&L / Profitability & Efficiency ---------------- */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gwp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gross Premium Written (GWP)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 28821159" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="net_claims_paid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Net Claims Paid</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 10000000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="investment_income_total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investment Income (Total)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 500000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commission_expense_total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Expense (Total)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 800000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="operating_expenses_total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operating Expenses (Total)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 600000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="profit_before_tax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profit Before Tax</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 2000000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* ------------- Mandatory Regulatory & Governance Disclosures ------------- */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="contingency_reserve_statutory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contingency Reserve (Statutory)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 1000000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ibnr_reserve_gross"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IBNR Reserve (Gross)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 500000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="irfs17_implementation_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFRS17 Implementation Status</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Implemented / In progress" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="related_party_net_exposure"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Related Party Net Exposure</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 250000" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="claims_development_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Claims Development / Reserving Method</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Chain Ladder" {...field} disabled={isLoading} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="auditors_unqualified_opinion"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            disabled={isLoading}
                            className="h-4 w-4"
                          />
                          <FormLabel className="m-0">Auditors Unqualified Opinion</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Progress Bar */}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-blue-600">
                        {uploadProgress < 40 && selectedFile && "Preparing upload..."}
                        {uploadProgress >= 40 && uploadProgress < 70 && selectedFile && "Uploading document..."}
                        {uploadProgress >= 70 && uploadProgress < 90 && "Recording on blockchain..."}
                        {uploadProgress >= 90 && "Finalizing..."}
                        {!selectedFile && "Submitting data..."}
                      </p>  
                    </div>
                  )}

                  <Separator />

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-blue-600 mt-1" />
                      <div>
                        <h4 className="font-medium text-blue-900">Blockchain Security & Submission Options</h4>
                        <p className="text-sm text-blue-700 mt-1 mb-2">
                          Your submission will be cryptographically secured on the blockchain.
                        </p>
                        <div className="text-xs text-blue-600 space-y-1">
                          <p>• File upload: AI extracts data automatically</p>
                          <p>• Manual entry: Full control over your data</p>
                          <p>• Hybrid: Upload file + manually review/adjust values</p>
                          <p>• Either method creates the same secure blockchain record</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(-1)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitDisabled()}
                    className="min-w-[140px]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {selectedFile ? 'Uploading...' : 'Submitting...'}
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        {selectedFile && !form.getValues('capital') ? 'Submit with File' :
                         !selectedFile ? 'Submit Manual Data' : 'Submit Hybrid Data'}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DataInputPage;

