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
  capital: z.preprocess(
    (a) => (a === '' ? undefined : a),
    z.coerce.number({ required_error: "Capital is required.", invalid_type_error: 'Please enter a number.' }).positive({ message: 'Capital must be a positive number.' })
  ),
  liabilities: z.preprocess(
    (a) => (a === '' ? undefined : a),
    z.coerce.number({ required_error: "Liabilities are required.", invalid_type_error: 'Please enter a number.' }).positive({ message: 'Liabilities must be a positive number.' })
  ),
  date: z.date({ required_error: 'A date is required.' }),
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
      capital: undefined,
      liabilities: undefined,
      date: new Date(),
    },
    mode: 'onChange',
  });
  const onSubmit = async (values: DataInputFormValues) => {
    setIsLoading(true);
    const submissionData = {
      capital: values.capital,
      liabilities: values.liabilities,
      date: values.date.toISOString(),
    };
    try {
      await addSubmission(submissionData);
      toast.success('Data Submitted Successfully!', {
        description: 'Your financial data has been recorded.',
      });
      navigate('/app/status');
    } catch (error) {
      // Error is already toasted in the store
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
                      <Input type="number" placeholder="e.g., 600000000" {...field} />
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
                      <Input type="number" placeholder="e.g., 400000000" {...field} />
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
                            variant={'outline'}
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
                          onSelect={field.onChange}
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Financial Statements (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="file" className="pl-10" accept=".pdf" onChange={(e) => field.onChange(e.target.files)} />
                        <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" disabled={isLoading || !form.formState.isValid}>
                {isLoading ? 'Submitting...' : 'Submit'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}