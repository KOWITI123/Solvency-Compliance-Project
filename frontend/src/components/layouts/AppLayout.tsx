import React, { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  FilePlus,
  ShieldCheck,
  LayoutDashboard,
  Database,
  LogOut,
  Menu,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Shield,
  Settings,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore, useIsLoadingData } from '@/stores/dataStore';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { UserRole } from '@/lib/types';
import { PageLoader } from '@/components/shared/PageLoader';
const navItems: Record<UserRole, { href: string; label: string; icon: React.ElementType }[]> = {
  Insurer: [
    { href: '/app', label: 'Home', icon: Home },
    { href: '/app/data-input', label: 'Input Data', icon: FilePlus },
    { href: '/app/status', label: 'Compliance Status', icon: ShieldCheck },
    { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/app/blockchain-log', label: 'Blockchain Log', icon: Database },
    { href: '/app/ussd-simulation', label: 'USSD Sim', icon: Smartphone },
  ],
  Regulator: [
    { href: '/app/audit', label: 'Audit Dashboard', icon: Shield },
  ],
  Admin: [
    { href: '/app/admin', label: 'Admin Dashboard', icon: Settings },
  ],
};
function NavLink({ href, icon: Icon, label, isCollapsed }: { href: string; icon: React.ElementType; label: string; isCollapsed: boolean }) {
  const { pathname } = useLocation();
  const isActive = pathname === href;
  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-4 rounded-lg px-4 py-3 text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90',
        isCollapsed && 'justify-center'
      )}
    >
      <Icon className="h-5 w-5" />
      {!isCollapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
}
function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const currentNavItems = user ? navItems[user.role] : [];
  return (
    <aside className={cn("hidden md:flex flex-col bg-sidebar border-r transition-all duration-300", isCollapsed ? "w-20" : "w-64")}>
      <div className="flex h-16 items-center justify-between border-b px-6">
        <Link to="/app" className={cn("font-bold text-xl text-primary", isCollapsed && "hidden")}>
          SolvaSure
        </Link>
        <Button variant="ghost" size="icon" onClick={onToggle} className="hidden md:flex">
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-2 p-4">
        {currentNavItems.map((item) => (
          <NavLink key={item.href} {...item} isCollapsed={isCollapsed} />
        ))}
      </nav>
      <div className="border-t p-4">
        <div className={cn("flex items-center gap-4", isCollapsed && "flex-col items-center gap-2")}>
          <div className="flex flex-col">
            {!isCollapsed && <span className="text-sm font-medium">{user?.username}</span>}
            {!isCollapsed && <span className="text-xs text-muted-foreground">{user?.role}</span>}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="ml-auto">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
function Header() {
  const { isDark, toggleTheme } = useTheme();
  const isOnline = useDataStore((s) => s.isOnline);
  const offlineQueueCount = useDataStore((s) => s.offlineQueue.length);
  const user = useAuthStore((s) => s.user);
  const currentNavItems = user ? navItems[user.role] : [];
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-8">
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0">
            <div className="flex h-16 items-center border-b px-6">
              <Link to="/app" className="font-bold text-xl text-primary">SolvaSure</Link>
            </div>
            <nav className="flex-1 space-y-2 p-4">
              {currentNavItems.map((item) => (
                <NavLink key={item.href} {...item} isCollapsed={false} />
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      <div className="flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          <span>{isOnline ? 'Online' : `Offline (${offlineQueueCount} queued)`}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  );
}
export function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const { fetchSubmissions } = useDataStore();
  const isLoading = useIsLoadingData();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else {
      fetchSubmissions();
    }
  }, [isAuthenticated, navigate, fetchSubmissions]);
  if (!isAuthenticated) {
    return null;
  }
  if (isLoading) {
    return <PageLoader />;
  }
  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl w-full">
            <Outlet context={{ isSidebarCollapsed: isCollapsed }} />
          </div>
        </main>
      </div>
      <Toaster richColors />
    </div>
  );
}