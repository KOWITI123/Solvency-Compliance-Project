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
import { CalendarIcon, Upload } from 'lucide-react';
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

export function DataInputPage() {
  const [isLoading, setIsLoading] = useState(false);
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

  const onSubmit = async (values: DataInputFormValues) => {
    setIsLoading(true);
    
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
    
    const submissionData = {
      capital,
      liabilities,
      date: values.date.toISOString(),
    };

    try {
      await addSubmission(submissionData);
      toast.success('Data Submitted Successfully!', {
        description: 'Your financial data has been recorded.',
      });
      navigate('/app/status');
    } catch (error) {
      toast.error('Submission failed', {
        description: 'Please try again or contact support.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-4xl font-bold tracking-tight">Input Financial Data</h1>
      <p className="text-lg text-muted-foreground">
        Submit your financial data for a specific date to calculate your compliance status.
      </p>

      <Card className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>New Data Submission</CardTitle>
              <CardDescription>All fields are required.</CardDescription>
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
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
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
                        />
                        <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              >
                {isLoading ? 'Submitting...' : 'Submit'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}