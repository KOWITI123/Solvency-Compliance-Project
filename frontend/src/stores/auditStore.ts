import { create } from 'zustand';

export interface AuditReview {
  id: string;
  submissionId: string;
  reviewerId: string;
  reviewerName: string;
  status: 'pending' | 'approved' | 'rejected' | 'requires_clarification';
  comments: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditSubmission {
  id: string;
  insurerId: string;
  insurerName: string;
  capital: number;
  liabilities: number;
  date: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
  lastReviewedAt?: string;
}

interface AuditStore {
  reviews: AuditReview[];
  submissions: AuditSubmission[];
  isLoading: boolean;
  fetchReviews: () => Promise<void>;
  fetchSubmissions: () => Promise<void>;
  updateReviewStatus: (reviewId: string, status: AuditReview['status'], comments: string) => Promise<void>;
  addReview: (submissionId: string, reviewData: Omit<AuditReview, 'id' | 'submissionId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

// Mock data
const mockSubmissions: AuditSubmission[] = [
  {
    id: '1',
    insurerId: 'insurer1',
    insurerName: 'ABC Insurance Ltd',
    capital: 600000000,
    liabilities: 400000000,
    date: '2024-03-15',
    status: 'pending',
    submittedAt: '2024-03-16T10:00:00Z',
  },
  {
    id: '2',
    insurerId: 'insurer2',
    insurerName: 'Kenya Micro Insurance',
    capital: 300000000,
    liabilities: 280000000,
    date: '2024-03-10',
    status: 'under_review',
    submittedAt: '2024-03-11T14:30:00Z',
    lastReviewedAt: '2024-03-12T09:15:00Z',
  },
];

const mockReviews: AuditReview[] = [
  {
    id: '1',
    submissionId: '2',
    reviewerId: 'regulator1',
    reviewerName: 'John Doe (IRA)',
    status: 'requires_clarification',
    comments: 'Please provide additional documentation for liability calculations.',
    createdAt: '2024-03-12T09:15:00Z',
    updatedAt: '2024-03-12T09:15:00Z',
  },
];

export const useAuditStore = create<AuditStore>((set, get) => ({
  reviews: [],
  submissions: [],
  isLoading: false,

  fetchReviews: async () => {
    set({ isLoading: true });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ reviews: mockReviews, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      set({ isLoading: false });
    }
  },

  fetchSubmissions: async () => {
    set({ isLoading: true });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      set({ submissions: mockSubmissions, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      set({ isLoading: false });
    }
  },

  updateReviewStatus: async (reviewId: string, status: AuditReview['status'], comments: string) => {
    set({ isLoading: true });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { reviews } = get();
      const updatedReviews = reviews.map(review =>
        review.id === reviewId
          ? { ...review, status, comments, updatedAt: new Date().toISOString() }
          : review
      );
      
      set({ reviews: updatedReviews, isLoading: false });
    } catch (error) {
      console.error('Failed to update review:', error);
      set({ isLoading: false });
    }
  },

  addReview: async (submissionId: string, reviewData: Omit<AuditReview, 'id' | 'submissionId' | 'createdAt' | 'updatedAt'>) => {
    set({ isLoading: true });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newReview: AuditReview = {
        ...reviewData,
        id: Date.now().toString(),
        submissionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const { reviews } = get();
      set({ reviews: [...reviews, newReview], isLoading: false });
    } catch (error) {
      console.error('Failed to add review:', error);
      set({ isLoading: false });
    }
  },
}));