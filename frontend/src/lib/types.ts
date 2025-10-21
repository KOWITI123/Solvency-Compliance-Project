export type UserRole = 'Insurer' | 'Regulator' | 'Admin';
export interface User {
  id: string;
  username: string;
  role: UserRole;
  businessName?: string;
  registrationNumber?: string;
  region?: string; // For Insurers
  size?: 'Small' | 'Medium' | 'Large'; // For Insurers
}
export interface Submission {
  id: string;
  capital: number;
  liabilities: number;
  date: string; // ISO string
  solvencyRatio: number;
  status: 'Compliant' | 'Non-Compliant';
  transactionHash: string;
}
export interface ComplianceStatus {
  status: 'Compliant' | 'Non-Compliant';
  solvencyRatio: number;
  capital: number;
  liabilities: number;
  lastCheck: string; // ISO string
}
export interface OfflineRequest {
  id: string;
  payload: {
    capital: number;
    liabilities: number;
    date: string;
  };
  timestamp: number;
}

export interface CapitalSolvencyMetrics {
  capitalAdequacyRatio: number;
  requiredCapital: number;
  availableCapital: number;
  totalAssets: number;
  totalLiabilities: number;
  asOfDate: string;
}

export interface InsurancePerformanceMetrics {
  insuranceServiceResult: number;
  insuranceRevenue: number;
  insuranceRevenueGrowth: number;
  previousYearRevenue: number;
  liabilityAdequacy: 'Adequate' | 'Insufficient' | 'Under Review';
  asOfDate: string;
}

export interface RiskManagementMetrics {
  reinsuranceStrategy: {
    creditRating: string;
    paymentHistory: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    lastReviewDate: string;
  };
  claimsDevelopment: {
    accuracyRate: number;
    reservingAdequacy: 'Adequate' | 'Under-Reserved' | 'Over-Reserved';
  };
  internalControls: {
    effectiveness: 'Strong' | 'Adequate' | 'Needs Improvement';
    lastAuditDate: string;
  };
}

export interface CorporateGovernanceMetrics {
  boardStructure: {
    totalMembers: number;
    independentDirectors: number;
    hasIndependentChair: boolean;
  };
  committees: Array<{
    name: string;
    members: number;
    meetingsPerYear: number;
  }>;
  relatedPartyTransactions: Array<{
    party: string;
    amount: number;
    description: string;
    date: string;
  }>;
  investmentPolicySubmitted: boolean;
  investmentPolicyDate: string;
}

export interface ComprehensiveComplianceData {
  capitalSolvency: CapitalSolvencyMetrics;
  insurancePerformance: InsurancePerformanceMetrics;
  riskManagement: RiskManagementMetrics;
  corporateGovernance: CorporateGovernanceMetrics;
  overallCompliance: 'Fully Compliant' | 'Partially Compliant' | 'Non-Compliant';
  lastAssessmentDate: string;
}