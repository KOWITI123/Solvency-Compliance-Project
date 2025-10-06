import { User } from './types';

export const MOCK_USERS: User[] = [
  {
    id: "1",
    username: "insurer@example.com",
    role: "Insurer",
    businessName: "ABC Insurance Ltd",
    registrationNumber: "INS001",
    region: "Nairobi",
    size: "Large"
  },
  {
    id: "2", 
    username: "regulator@ira.go.ke",
    role: "Regulator",
    businessName: "Insurance Regulatory Authority",
    registrationNumber: "REG001"
  },
  {
    id: "3",
    username: "admin@solvasure.co.ke", 
    role: "Admin",
    businessName: "SolvaSure Admin",
    registrationNumber: "ADM001"
  },
  {
    id: 'reg-1',
    username: 'regulator@ira.co.ke',
    role: 'Regulator',
    businessName: 'IRA Kenya',
    registrationNumber: 'IRA-001'
  },
  {
    id: 'admin-1', 
    username: 'admin@solvasure.co.ke',
    role: 'Admin',
    businessName: 'SolvaSure Kenya',
    registrationNumber: 'SS-001'
  }
];