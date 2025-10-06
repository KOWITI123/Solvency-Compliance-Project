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
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
  role: z.string().min(1, { message: 'Please select your role.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithUserData } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      role: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    console.log('Login form submitted with values:', values);
    setIsLoading(true);
    
    try {
      // Handle different roles based on selection
      if (values.role === 'regulator') {
        // Check regulator credentials
        if (values.email === 'regulator@ira.co.ke' && values.password === 'regulator123') {
          const success = login('regulator@ira.co.ke', 'Regulator');
          if (success) {
            toast.success('Login successful!', {
              description: 'Welcome back, Regulator!',
            });
            navigate('/app/audit'); // ← Changed from '/app/audit' to use navigate()
          } else {
            toast.error('Login Failed', {
              description: 'Regulator account not found in system.',
            });
          }
        } else {
          toast.error('Login Failed', {
            description: 'Invalid regulator credentials. Use: regulator@ira.co.ke / regulator123',
          });
        }
        setIsLoading(false);
        return;
      }

      if (values.role === 'admin') {
        // Check admin credentials
        if (values.email === 'admin@solvasure.co.ke' && values.password === 'admin123') {
          const success = login('admin@solvasure.co.ke', 'Admin');
          if (success) {
            toast.success('Login successful!', {
              description: 'Welcome back, Administrator!',
            });
            navigate('/app/admin'); // ← Changed to use navigate()
          } else {
            toast.error('Login Failed', {
              description: 'Admin account not found in system.',
            });
          }
        } else {
          toast.error('Login Failed', {
            description: 'Invalid admin credentials. Use: admin@solvasure.co.ke / admin123',
          });
        }
        setIsLoading(false);
        return;
      }

      if (values.role === 'insurer') {
        // For insurers, check the database
        const response = await fetch('http://localhost:5000/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
          }),
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
          console.log('✅ Backend login successful');
          console.log('📊 User data from backend:', data.user);
          
          // ✅ USE THE NEW METHOD for database users
          const success = loginWithUserData(data.user);
          console.log('🔐 AuthStore loginWithUserData success:', success);
          
          if (success) {
            toast.success('Login successful!', {
              description: `Welcome back, ${data.user.username}!`,
            });
            
            localStorage.setItem('user', JSON.stringify(data.user));
            
            console.log('🧭 Navigating to /app');
            navigate('/app');
          } else {
            toast.error('Login Failed', {
              description: 'Failed to set user session.',
            });
          }
        } else {
          // Handle login errors
          console.error('Login failed:', data.error);
          toast.error('Login Failed', { 
            description: data.error || 'Invalid email or password.' 
          });
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('Login Failed', { 
        description: 'Could not connect to server. Please check your connection and try again.' 
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
          <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your SolvaSure account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login as</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="insurer">
                          <div className="flex flex-col">
                            <span className="font-medium">Insurer</span>
                            <span className="text-xs text-muted-foreground">Submit financial data</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="regulator">
                          <div className="flex flex-col">
                            <span className="font-medium">Regulator</span>
                            <span className="text-xs text-muted-foreground">Review and approve submissions</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex flex-col">
                            <span className="font-medium">Administrator</span>
                            <span className="text-xs text-muted-foreground">System administration</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </Form>
          
          {/* Development Login Information */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center mb-2">
              <strong>Development Access:</strong>
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• <strong>Insurers:</strong> Sign up and login with database</div>
              <div>• <strong>Regulator:</strong> regulator@ira.co.ke / regulator123</div>
              <div>• <strong>Admin:</strong> admin@solvasure.co.ke / admin123</div>
            </div>
          </div>
          
          <div className="mt-6 text-center text-sm">
            <div className="space-y-2">
              <div>
                New insurer?{' '}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Sign up here
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}