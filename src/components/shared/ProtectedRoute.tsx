import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/lib/types';
const roleConfig: Record<UserRole, { defaultPath: string; allowedPaths: string[] }> = {
  Insurer: {
    defaultPath: '/app',
    allowedPaths: ['/app', '/app/data-input', '/app/status', '/app/dashboard', '/app/blockchain-log', '/app/ussd-simulation'],
  },
  Regulator: {
    defaultPath: '/app/audit',
    allowedPaths: ['/app/audit'],
  },
  Admin: {
    defaultPath: '/app/admin',
    allowedPaths: ['/app/admin'],
  },
};
interface ProtectedRouteProps {
  children: React.ReactNode;
}
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  const config = roleConfig[user.role];
  // For index route under /app, location.pathname will be /app
  const currentPath = location.pathname;
  if (!config.allowedPaths.includes(currentPath)) {
    // If user tries to access a path not allowed for their role, redirect them to their default page.
    return <Navigate to={config.defaultPath} replace />;
  }
  return <>{children}</>;
}