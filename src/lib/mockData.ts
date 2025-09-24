import { User, Submission } from '@/lib/types';
export const MOCK_USERS: User[] = [
  { 
    id: 'user-1', 
    username: 'insurer@solvasure.co.ke', 
    role: 'Insurer',
    businessName: 'Kenya Micro-Insurer Ltd.',
    registrationNumber: 'BN-123456'
  },
  { 
    id: 'user-2', 
    username: 'regulator@ira.go.ke', 
    role: 'Regulator' 
  },
  { 
    id: 'user-3', 
    username: 'admin@solvasure.co.ke', 
    role: 'Admin' 
  },
];
const generateMockSubmissions = (): Submission[] => {
  const submissions: Submission[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const capital = 450_000_000 + Math.random() * 200_000_000 - 100_000_000;
    const liabilities = 300_000_000 + Math.random() * 100_000_000;
    const solvencyRatio = liabilities > 0 ? capital / liabilities : Infinity;
    const status = solvencyRatio >= 1.0 ? 'Compliant' : 'Non-Compliant';
    submissions.push({
      id: `sub-${i}`,
      capital,
      liabilities,
      date: date.toISOString(),
      solvencyRatio,
      status,
      transactionHash: `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    });
  }
  return submissions;
};
export const MOCK_SUBMISSIONS: Submission[] = generateMockSubmissions();