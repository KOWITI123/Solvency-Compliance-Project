import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const signUpSchema = z.object({
  businessName: z.string().min(1, { message: 'Business name is required.' }),
  registrationNumber: z.string().min(1, { message: 'Registration number is required.' }),
  username: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignUpPage() {
  const navigate = useNavigate();
  const signup = useAuthStore((state) => state.signup);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      businessName: '',
      registrationNumber: '',
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignUpFormValues) => {
    console.log('Form submitted with values:', values);
    setIsLoading(true);
    
    try {
      const requestBody = {
        business_name: values.businessName,
        registration_number: values.registrationNumber,
        business_email: values.username,
        password: values.password,
        role: 'insurer', // Always insurer for signup
      };
      
      console.log('Sending request to API:', requestBody);
      
      const response = await fetch('http://localhost:5000/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      // ✅ IMPROVED SUCCESS CHECK
      if (response.ok && data.success) {
        // Success - call auth store
        signup({
          username: data.user.business_email,  // ✅ Use data.user.business_email
          businessName: data.user.business_name,  // ✅ Use data.user.business_name
          registrationNumber: data.user.registration_number,  // ✅ Use data.user.registration_number
        });

        toast.success('Registration successful!', {
          description: 'You can now log in with your new account.',
        });
        
        // ✅ NAVIGATE TO CORRECT LOGIN ROUTE
        navigate('/login');  // ✅ Changed from '/signin' to '/login'
        
      } else {
        // API returned an error
        console.error('API Error:', data.error);
        toast.error('Registration Failed', { 
          description: data.error || 'An error occurred during registration.' 
        });
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('Registration Failed', { 
        description: 'Could not connect to server. Please make sure the backend is running.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <Card className="w-full max-w-md animate-scale-in shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full text-primary-foreground">
              <ShieldCheck className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join SolvaSure Kenya as an Insurance Company.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Kenya Micro-Insurer Ltd." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., BN-123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your-business@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full font-semibold text-lg py-6 transition-all hover:scale-105 active:scale-95" 
                disabled={isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>
          </Form>
          
          {/* Information for insurers */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <strong>For Insurance Companies Only</strong>
            </p>
            <div className="text-xs text-muted-foreground mt-1 text-center">
              Regulatory staff will be provided separate access credentials
            </div>
          </div>
          
          <div className="mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}