import { Hono } from "hono";
import { Env } from './core-utils';
import { User } from '../src/lib/types';
// In-memory store for demonstration purposes. In a real application, you'd use KV, D1, or another database.
let submissions: any[] = [];
let users: User[] = [
    { id: 'user-1', username: 'insurer@solvasure.co.ke', role: 'Insurer', businessName: 'Kenya Micro-Insurer Ltd.', registrationNumber: 'BN-123456' },
    { id: 'user-2', username: 'regulator@ira.go.ke', role: 'Regulator' },
    { id: 'user-3', username: 'admin@solvasure.co.ke', role: 'Admin' },
];
const IRA_GENERAL_THRESHOLD = 400_000_000;
const calculateCompliance = (capital: number, liabilities: number) => {
  const solvencyRatio = liabilities > 0 ? capital / liabilities : Infinity;
  const isCapitalCompliant = capital >= IRA_GENERAL_THRESHOLD;
  const isRatioCompliant = solvencyRatio >= 1.0;
  const status = isCapitalCompliant && isRatioCompliant ? 'Compliant' : 'Non-Compliant';
  return { solvencyRatio, status };
};
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // Add more routes like this. **DO NOT MODIFY CORS OR OVERRIDE ERROR HANDLERS**
    app.get('/api/test', (c) => c.json({ success: true, data: { name: 'this works' }}));
    app.get('/api/submissions', (c) => {
        return c.json({ success: true, data: submissions });
    });
    app.post('/api/submissions', async (c) => {
        try {
            const body = await c.req.json();
            const { capital, liabilities, date } = body;
            if (typeof capital !== 'number' || typeof liabilities !== 'number' || typeof date !== 'string') {
                return c.json({ success: false, error: 'Invalid submission data' }, 400);
            }
            const { solvencyRatio, status } = calculateCompliance(capital, liabilities);
            const newSubmission = {
                id: `sub-${Date.now()}`,
                capital,
                liabilities,
                date,
                solvencyRatio,
                status,
                transactionHash: `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
            };
            submissions.push(newSubmission);
            submissions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return c.json({ success: true, data: newSubmission }, 201);
        } catch (error) {
            console.error('Failed to create submission:', error);
            return c.json({ success: false, error: 'Internal Server Error' }, 500);
        }
    });
    app.post('/api/register', async (c) => {
        try {
            const body = await c.req.json();
            const { username, businessName, registrationNumber } = body;
            if (!username || !businessName || !registrationNumber) {
                return c.json({ success: false, error: 'Missing required fields' }, 400);
            }
            const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (existingUser) {
                return c.json({ success: false, error: 'User with this email already exists' }, 409);
            }
            const newUser: User = {
                id: `user-${Date.now()}`,
                username,
                businessName,
                registrationNumber,
                role: 'Insurer',
            };
            users.push(newUser);
            return c.json({ success: true, data: newUser }, 201);
        } catch (error) {
            console.error('Failed to register user:', error);
            return c.json({ success: false, error: 'Internal Server Error' }, 500);
        }
    });
}