import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MOCK_USERS } from '@/lib/mockData';
import { User } from '@/lib/types';
import { Edit, Trash, UserPlus } from 'lucide-react';
function UserManagementTab() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Add, edit, or remove users from the system.</CardDescription>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_USERS.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon">
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
function SystemLogsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Logs</CardTitle>
        <CardDescription>View system errors and important events.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 border rounded-lg p-4 bg-muted font-mono text-sm overflow-auto">
          <p>[{new Date().toISOString()}] INFO: User 'admin@solvasure.co.ke' logged in.</p>
          <p>[{new Date().toISOString()}] WARN: High memory usage detected.</p>
          <p>[{new Date().toISOString()}] ERROR: Failed to connect to external service.</p>
        </div>
      </CardContent>
    </Card>
  );
}
function SettingsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage application-wide settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Settings management interface coming soon.</p>
      </CardContent>
    </Card>
  );
}
export function AdminDashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-lg text-muted-foreground">System management and configuration.</p>
      </div>
      <Tabs defaultValue="user-management">
        <TabsList>
          <TabsTrigger value="user-management">User Management</TabsTrigger>
          <TabsTrigger value="system-logs">System Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="user-management" className="mt-4">
          <UserManagementTab />
        </TabsContent>
        <TabsContent value="system-logs" className="mt-4">
          <SystemLogsTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}