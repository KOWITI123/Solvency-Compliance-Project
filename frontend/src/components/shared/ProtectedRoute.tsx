import { useAuthStore } from '@/stores/authStore';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  
  console.log('ProtectedRoute Debug:', {
    isAuthenticated,
    user,
    currentPath: location.pathname,
    timestamp: new Date().toISOString()
  });
  
  // If not authenticated, redirect to login
  if (!isAuthenticated || !user) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // For now, allow all authenticated users to access any /app route
  // We'll add role-based restrictions later once basic navigation works
  console.log('User authenticated, allowing access');
  return <>{children}</>;
}