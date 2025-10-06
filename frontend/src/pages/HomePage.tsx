import { Link, useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FilePlus, ShieldCheck, LayoutDashboard, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLatestComplianceStatus } from '@/stores/dataStore';
import { ComplianceBadge } from '@/components/shared/ComplianceBadge';
import { format } from 'date-fns';
const actionCards = [
  {
    title: 'Input Financial Data',
    description: 'Submit your latest capital and liabilities information.',
    icon: FilePlus,
    href: '/app/data-input',
    color: 'text-blue-500',
  },
  {
    title: 'View Compliance Status',
    description: 'Check your current solvency and capital adequacy status.',
    icon: ShieldCheck,
    href: '/app/status',
    color: 'text-green-500',
  },
  {
    title: 'View Dashboard',
    description: 'Analyze trends and visualize your compliance history.',
    icon: LayoutDashboard,
    href: '/app/dashboard',
    color: 'text-purple-500',
  },
];
type AppLayoutContext = {
  isSidebarCollapsed: boolean;
};
export function HomePage() {
  const { isSidebarCollapsed } = useOutletContext<AppLayoutContext>();
  const user = useAuthStore((state) => state.user);
  const latestStatus = useLatestComplianceStatus();
  return (
    <div className="space-y-12 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Welcome, {user?.username.split('@')[0] || 'Insurer'}!</h1>
        <p className="text-lg text-muted-foreground">
          Your central hub for managing solvency compliance with IRA requirements.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {actionCards.map((card) => (
          <Link to={card.href} key={card.title} className="group">
            <Card className="h-full flex flex-col transition-all duration-200 hover:shadow-xl hover:-translate-y-1.5">
              <CardHeader className="flex-row items-center gap-4">
                <div className={`p-3 rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-muted-foreground">{card.description}</p>
              </CardContent>
              <div className="p-6 pt-0">
                <div className="flex items-center text-sm font-semibold text-primary group-hover:underline">
                  Go to {card.title.split(' ')[1]} <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {latestStatus && (
        <div className={`fixed bottom-0 left-0 ${isSidebarCollapsed ? 'md:left-20' : 'md:left-64'} right-0 bg-background border-t p-4 transition-all duration-300`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-semibold">Latest Compliance Status:</span>
              <ComplianceBadge status={latestStatus.status} />
            </div>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Last checked: {format(new Date(latestStatus.lastCheck), "PPP p")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}