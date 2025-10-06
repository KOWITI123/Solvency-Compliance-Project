import { Hono } from "hono";
import { Env } from './core-utils';
import { User, Submission, ComplianceReview, NotificationMessage, Annotation, UserRole } from '../src/lib/types';
// In-memory store for demonstration purposes.
let submissions: Submission[] = [];
let users: User[] = [
    { id: 'user-1', username: 'insurer@solvasure.co.ke', role: 'Insurer', businessName: 'Kenya Micro-Insurer Ltd.', registrationNumber: 'BN-123456', region: 'Nairobi', size: 'Medium' },
    { id: 'user-2', username: 'regulator@ira.go.ke', role: 'Regulator' },
    { id: 'user-3', username: 'admin@solvasure.co.ke', role: 'Admin' },
    { id: 'user-4', username: 'coastinsure@example.com', role: 'Insurer', businessName: 'Coastal Assurance', registrationNumber: 'BN-654321', region: 'Mombasa', size: 'Large' },
    { id: 'user-5', username: 'riftvalley@example.com', role: 'Insurer', businessName: 'Rift Valley Cover', registrationNumber: 'BN-789012', region: 'Nakuru', size: 'Small' },
];
let reviews: ComplianceReview[] = [];
let notifications: NotificationMessage[] = [];
let annotations: Annotation[] = [];
const IRA_GENERAL_THRESHOLD = 400_000_000;
const calculateCompliance = (capital: number, liabilities: number) => {
  const solvencyRatio = liabilities > 0 ? capital / liabilities : Infinity;
  const isCapitalCompliant = capital >= IRA_GENERAL_THRESHOLD;
  const isRatioCompliant = solvencyRatio >= 1.0;
  const status: 'Compliant' | 'Non-Compliant' = isCapitalCompliant && isRatioCompliant ? 'Compliant' : 'Non-Compliant';
  return { solvencyRatio, status };
};
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/submissions', (c) => c.json({ success: true, data: submissions }));
    app.post('/api/submissions', async (c) => {
        const body = await c.req.json();
        const { capital, liabilities, date } = body;
        if (typeof capital !== 'number' || typeof liabilities !== 'number' || typeof date !== 'string') {
            return c.json({ success: false, error: 'Invalid submission data' }, 400);
        }
        const { solvencyRatio, status } = calculateCompliance(capital, liabilities);
        const newSubmission: Submission = {
            id: `sub-${Date.now()}`, capital, liabilities, date, solvencyRatio, status,
            transactionHash: `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
            annotations: [],
        };
        submissions.push(newSubmission);
        submissions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return c.json({ success: true, data: newSubmission }, 201);
    });
    app.post('/api/register', async (c) => {
        const body = await c.req.json();
        const { username, businessName, registrationNumber } = body;
        if (!username || !businessName || !registrationNumber) {
            return c.json({ success: false, error: 'Missing required fields' }, 400);
        }
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            return c.json({ success: false, error: 'User with this email already exists' }, 409);
        }
        const newUser: User = {
            id: `user-${Date.now()}`, username, businessName, registrationNumber, role: 'Insurer',
            region: ['Nairobi', 'Mombasa', 'Nakuru'][Math.floor(Math.random() * 3)],
            size: ['Small', 'Medium', 'Large'][Math.floor(Math.random() * 3)] as any,
        };
        users.push(newUser);
        return c.json({ success: true, data: newUser }, 201);
    });
    // New Regulator Endpoints
    app.get('/api/reviews', (c) => c.json({ success: true, data: reviews }));
    app.post('/api/reviews', async (c) => {
        const body = await c.req.json();
        const { insurerId, notes, reviewer } = body;
        if (!insurerId || !notes || !reviewer) return c.json({ success: false, error: 'Missing fields' }, 400);
        const newReview: ComplianceReview = {
            id: `rev-${Date.now()}`, insurerId, notes, reviewer,
            date: new Date().toISOString(), status: 'Pending',
        };
        reviews.unshift(newReview);
        return c.json({ success: true, data: newReview }, 201);
    });
    app.get('/api/notifications', (c) => c.json({ success: true, data: notifications }));
    app.post('/api/notifications', async (c) => {
        const body = await c.req.json();
        const { insurerId, message } = body;
        if (!insurerId || !message) return c.json({ success: false, error: 'Missing fields' }, 400);
        const newNotification: NotificationMessage = {
            id: `notif-${Date.now()}`, insurerId, message,
            timestamp: new Date().toISOString(), read: false,
        };
        notifications.unshift(newNotification);
        return c.json({ success: true, data: newNotification }, 201);
    });
    app.post('/api/annotations', async (c) => {
        const body = await c.req.json();
        const { submissionId, text, author, isFlagged } = body;
        if (!submissionId || !text || !author) return c.json({ success: false, error: 'Missing fields' }, 400);
        const newAnnotation: Annotation = {
            id: `anno-${Date.now()}`, submissionId, text, author, isFlagged,
            timestamp: new Date().toISOString(),
        };
        annotations.push(newAnnotation);
        const submission = submissions.find(s => s.id === submissionId);
        if (submission) {
            if (!submission.annotations) submission.annotations = [];
            submission.annotations.push(newAnnotation);
        }
        return c.json({ success: true, data: newAnnotation }, 201);
    });
}