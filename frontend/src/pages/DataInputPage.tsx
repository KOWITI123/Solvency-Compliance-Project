import { useState } from 'react';
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
  Upload, 
  Hash, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Database,
  Lock,
  Clock,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDataStore } from '@/stores/dataStore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const dataInputSchema = z.object({
  capital: z.string().min(1, 'Capital is required.'),
  liabilities: z.string().min(1, 'Liabilities is required.'),
  date: z.date(),
  financialStatement: z.any().optional(),
});

type DataInputFormValues = z.infer<typeof dataInputSchema>;

interface BlockchainSubmissionResult {
  success: boolean;
  data_hash: string;
  transaction_id: number;
  message: string;
  status: string;
  capital: number;
  liabilities: number;
  submission_date: string;
}

export function DataInputPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<BlockchainSubmissionResult | null>(null);
  const [isSubmissionComplete, setIsSubmissionComplete] = useState(false);
  const addSubmission = useDataStore((state) => state.addSubmission);
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

  // ✅ BLOCKCHAIN SUBMISSION FUNCTION (Modified for pending approval)
  const submitToBlockchain = async (formData: any) => {
    try {
      console.log('🔗 Submitting to blockchain for regulator approval...', formData);
      
      const response = await fetch('http://localhost:5000/api/submit-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      console.log('📊 Blockchain response:', result);

      if (response.ok && result.success) {
        return {
          success: true,
          data_hash: result.data_hash,
          transaction_id: result.transaction_id,
          message: result.message,
          status: result.status || 'INSURER_SUBMITTED',
          capital: formData.capital,
          liabilities: formData.liabilities,
          submission_date: formData.submission_date
          // ✅ NO solvency_ratio or compliance_status expected here!
        };
      } else {
        throw new Error(result.error || 'Blockchain submission failed');
      }
    } catch (error) {
      console.error('❌ Blockchain submission error:', error);
      throw error;
    }
  };

  const onSubmit = async (values: DataInputFormValues) => {
    setIsLoading(true);
    setSubmissionResult(null);
    setIsSubmissionComplete(false);
    
    // Validate and convert to numbers
    const capital = parseFloat(values.capital);
    const liabilities = parseFloat(values.liabilities);
    
    if (isNaN(capital) || capital <= 0) {
      toast.error('Please enter a valid positive number for capital.');
      setIsLoading(false);
      return;
    }
    
    if (isNaN(liabilities) || liabilities <= 0) {
      toast.error('Please enter a valid positive number for liabilities.');
      setIsLoading(false);
      return;
    }

    // ✅ PREPARE DATA FOR BLOCKCHAIN SUBMISSION (Raw data only)
    const blockchainData = {
      insurer_id: 1, // This should come from user context in a real app
      capital,
      liabilities,
      submission_date: values.date.toISOString(),
    };

    try {
      // ✅ SUBMIT TO BLOCKCHAIN FOR PENDING APPROVAL
      const blockchainResult = await submitToBlockchain(blockchainData);
      
      if (blockchainResult.success) {
        setSubmissionResult(blockchainResult);
        setIsSubmissionComplete(true);
        
        // ✅ UPDATE LOCAL STORE (existing functionality)
        const submissionData = {
          capital,
          liabilities,
          date: values.date.toISOString(),
        };
        
        await addSubmission(submissionData);
        
        toast.success('📋 Data Submitted Successfully!', {
          description: `Your submission is now pending regulator approval. Hash: ${blockchainResult.data_hash.substring(0, 16)}...`,
        });
        
        // Auto-redirect after 5 seconds to show the status
        setTimeout(() => {
          navigate('/app/status');
        }, 5000);
        
      } else {
        throw new Error('Blockchain submission failed');
      }
      
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('🚨 Submission Failed', {
        description: error instanceof Error ? error.message : 'Please try again or contact support.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ RESET FORM FOR NEW SUBMISSION
  const handleNewSubmission = () => {
    setSubmissionResult(null);
    setIsSubmissionComplete(false);
    form.reset({
      capital: '',
      liabilities: '',
      date: new Date(),
    });
  };

  // ✅ GET STATUS STYLING (Updated for pending state)
  const getStatusStyling = (status: string) => {
    switch (status) {
      case 'REGULATOR_APPROVED':
        return { variant: 'default' as const, className: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' };
      case 'REJECTED':
        return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Rejected' };
      case 'INSURER_SUBMITTED':
      default:
        return { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending Approval' };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <Database className="h-10 w-10" />
          Submit Financial Data
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Submit your financial data for regulatory review and blockchain verification
        </p>
      </div>

      {/* ✅ SUBMISSION SUCCESS RESULT (Updated for pending approval) */}
      {isSubmissionComplete && submissionResult && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Clock className="h-6 w-6" />
              Submission Pending Approval
            </CardTitle>
            <CardDescription className="text-blue-700">
              Your financial data has been submitted and is awaiting regulator review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-blue-800">Transaction Hash</label>
                  <div className="flex items-center gap-2 p-2 bg-white rounded border">
                    <Hash className="h-4 w-4" />
                    <code className="text-xs break-all">{submissionResult.data_hash}</code>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-800">Transaction ID</label>
                  <p className="text-lg font-bold">#{submissionResult.transaction_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-800">Submission Date</label>
                  <p className="text-sm">
                    {format(new Date(submissionResult.submission_date), 'PPP pp')}
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-blue-800">Capital Submitted</label>
                  <p className="text-lg font-bold text-green-600">
                    KES {submissionResult.capital.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-800">Liabilities Submitted</label>
                  <p className="text-lg font-bold text-red-600">
                    KES {submissionResult.liabilities.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-800">Current Status</label>
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
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">
                    Awaiting Regulator Review
                  </p>
                  <p className="text-xs text-yellow-700">
                    Your submission will be reviewed by the regulator. Solvency ratio and compliance status will be calculated upon approval.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">
                    Blockchain Secured
                  </p>
                  <p className="text-xs text-blue-700">
                    This submission is cryptographically secured and immutable on the blockchain.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button onClick={handleNewSubmission} variant="outline">
                Submit New Data
              </Button>
              <Button onClick={() => navigate('/app/status')}>
                <Eye className="mr-2 h-4 w-4" />
                View Submission Status
              </Button>
              <Button onClick={() => navigate('/app/blockchain')} variant="outline">
                <Hash className="mr-2 h-4 w-4" />
                View Blockchain Log
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ SUBMISSION FORM (only show if not completed) */}
      {!isSubmissionComplete && (
        <Card className="max-w-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Financial Data Submission
                </CardTitle>
                <CardDescription>
                  Submit your financial data for regulatory review. Solvency calculations will be performed after regulator approval.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="capital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capital (KES)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 600000000" 
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="liabilities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Liabilities (KES)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 400000000" 
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Submission Date</FormLabel>
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
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
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

                <FormField
                  control={form.control}
                  name="financialStatement"
                  render={({ field: { onChange, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel>Financial Statements (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...fieldProps}
                            type="file" 
                            className="pl-10" 
                            accept=".pdf,.xlsx,.xls" 
                            onChange={(e) => onChange(e.target.files)}
                            disabled={isLoading}
                          />
                          <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* ✅ APPROVAL PROCESS INFO */}
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-600 mt-1" />
                    <div>
                      <h4 className="font-medium text-amber-900">Two-Stage Approval Process</h4>
                      <p className="text-sm text-amber-700 mt-1">
                        1. <strong>Submit Data:</strong> Your financial data is recorded on blockchain<br/>
                        2. <strong>Regulator Review:</strong> Solvency ratio and compliance status calculated after approval
                      </p>
                    </div>
                  </div>
                </div>

                {/* ✅ BLOCKCHAIN INFO */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-blue-600 mt-1" />
                    <div>
                      <h4 className="font-medium text-blue-900">Blockchain Security</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Your submission will be hashed using SHA-256 and recorded on the blockchain for immutable audit trail.
                      </p>
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
                  disabled={isLoading}
                  className="min-w-[160px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting for Review...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Submit for Approval
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      )}
    </div>
  );
}