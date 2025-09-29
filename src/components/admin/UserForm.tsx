import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { User, UserRole } from '@/lib/types';

const userFormSchema = z.object({
  username: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.string().refine((value): value is UserRole => {
    return ['Insurer', 'Regulator', 'Admin'].includes(value as UserRole);
  }, {
    message: "Please select a valid role.",
  }),
  businessName: z.string().optional(),
  registrationNumber: z.string().optional(),
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

export type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: User | null;
  onSubmit: (data: { username: string; role: UserRole; businessName?: string; registrationNumber?: string; }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function UserForm({ user, onSubmit, onCancel, isSubmitting }: UserFormProps) {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: user?.username || '',
      role: user?.role || '',
      businessName: user?.businessName || '',
      registrationNumber: user?.registrationNumber || '',
    },
  });

  const handleSubmit = (data: UserFormData) => {
    onSubmit({
      username: data.username,
      role: data.role as UserRole,
      businessName: data.businessName,
      registrationNumber: data.registrationNumber,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="user@example.com" {...field} />
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
                    <SelectValue placeholder="Select a role" />
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

        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Name (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Business name" {...field} />
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
              <FormLabel>Registration Number (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Registration number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : user ? 'Update User' : 'Add User'}
          </Button>
        </div>
      </form>
    </Form>
  );
}