import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/lib/types';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const loginSchema = z.object({
  username: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
  role: z.string().min(1, { message: 'Please select a role.' }),
}).refine(data => {
  if (data.role === 'Regulator' && !data.username.endsWith('@ira.go.ke')) {
    return false;
  }
  if (data.role === 'Admin' && !data.username.endsWith('@solvasure.co.ke')) {
    return false;
  }
  return true;
}, {
  message: "Email domain does not match the selected role.",
  path: ["username"],
});

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      role: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    console.log('=== FORM SUBMISSION ===');
    console.log('Form values:', values);
    
    try {
      // For demo purposes, we'll create the login logic here since the auth store is limited
      // In a real app, this would be handled by the backend
      const success = login(values.username, values.role as UserRole);
      
      // If the predefined user doesn't exist, create a temporary one for demo
      if (!success && values.role) {
        console.log('Creating temporary user for demo');
        
        // Temporarily set auth state for demo purposes
        const authStore = useAuthStore.getState();
        authStore.isAuthenticated = true;
        authStore.user = {
          id: Date.now().toString(),
          username: values.username,
          role: values.role as UserRole,
          businessName: values.role === 'Insurer' ? 'Demo Insurance Company' : 
                       values.role === 'Regulator' ? 'Insurance Regulatory Authority' : 
                       'SolvaSure Admin',
          registrationNumber: 'DEMO-' + Math.random().toString(36).substr(2, 9),
          region: 'Nairobi',
          size: 'Medium'
        };
      }
      
      const currentState = useAuthStore.getState();
      console.log('Auth state after login:', {
        isAuthenticated: currentState.isAuthenticated,
        user: currentState.user
      });
      
      if (currentState.isAuthenticated && currentState.user) {
        toast.success('Login successful!');
        
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const user = currentState.user;
        console.log('About to navigate with user:', user);
        
        let targetPath = '/app';
        
        if (user.role === 'Regulator') {
          targetPath = '/app/audit';
          console.log('Navigating to /app/audit');
        } else if (user.role === 'Admin') {
          targetPath = '/app/admin';
          console.log('Navigating to /app/admin');
        } else {
          targetPath = '/app';
          console.log('Navigating to /app');
        }
        
        navigate(targetPath, { replace: true });
        
      } else {
        console.log('Login failed - authentication unsuccessful');
        toast.error('Invalid Credentials', { 
          description: 'Please check your email and role.'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed', { description: 'An error occurred during login.' });
    }
    
    setIsLoading(false);
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
          <CardTitle className="text-3xl font-bold">SolvaSure Kenya</CardTitle>
          <CardDescription>Empowering Micro-Insurers in Kenya</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your-email@example.com" {...field} />
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <a href="#" className="text-sm font-medium text-primary hover:underline">
                        Forgot Password?
                      </a>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Insurer">Insurer</SelectItem>
                        <SelectItem value="Regulator">Regulator</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full font-semibold text-lg py-6 transition-all hover:scale-105 active:scale-95" 
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 text-center text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </div>
          
          <div className="mt-4 p-3 bg-muted rounded-lg text-xs">
            <p className="font-medium mb-1">Demo Credentials (any password works):</p>
            <p>• Insurer: any@example.com, john@company.com, etc.</p>
            <p>• Regulator: any@ira.go.ke (must end with @ira.go.ke)</p>
            <p>• Admin: any@solvasure.co.ke (must end with @solvasure.co.ke)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}