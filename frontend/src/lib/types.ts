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