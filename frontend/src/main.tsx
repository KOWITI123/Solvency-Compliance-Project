import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css';
// Layouts
import { AppLayout } from '@/components/layouts/AppLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
// Pages
import { SplashPage } from '@/pages/SplashPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { HomePage } from '@/pages/HomePage';
import DataInputPage from './pages/DataInputPage';
import { ComplianceStatusPage } from '@/pages/ComplianceStatusPage';
import { InsurerDashboardPage } from '@/pages/InsurerDashboardPage';
import { BlockchainLogPage } from '@/pages/BlockchainLogPage';
import { AuditDashboardPage } from '@/pages/AuditDashboardPage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { UssdSimulationPage } from '@/pages/UssdSimulationPage';
import { CapitalSolvencyPage } from '@/pages/CapitalSolvencyPage';
import { InsurancePerformancePage } from '@/pages/InsurancePerformancePage';
import { RiskManagementPage } from '@/pages/RiskManagementPage';
import { CorporateGovernancePage } from '@/pages/CorporateGovernancePage';
const router = createBrowserRouter([
  {
    path: "/",
    element: <SplashPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/signup",
    element: <SignUpPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "data-input", element: <DataInputPage /> },
      { path: "status", element: <ComplianceStatusPage /> },
      { path: "dashboard", element: <InsurerDashboardPage /> },
      { path: "blockchain-log", element: <BlockchainLogPage /> },
      { path: "audit", element: <AuditDashboardPage /> },
      { path: "admin", element: <AdminDashboardPage /> },
      { path: "ussd-simulation", element: <UssdSimulationPage /> },
      { path: "capital-solvency", element: <CapitalSolvencyPage /> },
      { path: "insurance-performance", element: <InsurancePerformancePage /> },
      { path: "risk-management", element: <RiskManagementPage /> },
      { path: "corporate-governance", element: <CorporateGovernancePage /> },
    ],
  },
]);
// Do not touch this code
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);