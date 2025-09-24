import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Submission, ComplianceStatus, OfflineRequest } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
interface DataState {
  submissions: Submission[];
  offlineQueue: OfflineRequest[];
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  fetchSubmissions: () => Promise<void>;
  addSubmission: (data: { capital: number; liabilities: number; date: string }) => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => void;
  processOfflineQueue: () => Promise<void>;
}
export const useDataStore = create<DataState>()(
  persist(
    immer((set, get) => ({
      submissions: [],
      offlineQueue: [],
      isOnline: navigator.onLine,
      isLoading: true,
      error: null,
      fetchSubmissions: async () => {
        // Prevent refetching if already loading or has data
        if (get().isLoading === false && get().submissions.length > 0) {
            set({ isLoading: false });
            return;
        }
        set({ isLoading: true, error: null });
        try {
          const submissions = await api.getSubmissions();
          set({
            submissions: submissions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            isLoading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
          set({ isLoading: false, error: errorMessage });
          toast.error("Failed to load data", { description: errorMessage });
        }
      },
      addSubmission: async (data) => {
        if (!get().isOnline) {
          set((state) => {
            state.offlineQueue.push({
              id: `offline-${Date.now()}`,
              payload: data,
              timestamp: Date.now(),
            });
          });
          toast.info("You are offline", { description: "Your submission has been queued and will be sent when you're back online." });
          return;
        }
        try {
          const newSubmission = await api.createSubmission(data);
          set((state) => {
            state.submissions.unshift(newSubmission);
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to submit data';
          toast.error("Submission Failed", { description: errorMessage });
          throw error; // Re-throw to be caught in the component
        }
      },
      setOnlineStatus: (isOnline) => {
        set({ isOnline });
        if (isOnline) {
          toast.success("You are back online!", { description: "Syncing any pending data..." });
          get().processOfflineQueue();
        } else {
          toast.warning("You are offline", { description: "Submissions will be queued." });
        }
      },
      processOfflineQueue: async () => {
        const queue = get().offlineQueue;
        if (queue.length === 0) return;
        toast.info(`Syncing ${queue.length} offline submission(s)...`);
        const successfullySynced: string[] = [];
        for (const req of queue) {
          try {
            const newSubmission = await api.createSubmission(req.payload);
            set((state) => {
              state.submissions.unshift(newSubmission);
            });
            successfullySynced.push(req.id);
          } catch (error) {
            console.error('Failed to sync offline submission:', error);
            toast.error(`Failed to sync submission from ${new Date(req.timestamp).toLocaleString()}`);
            // Stop processing on first error to maintain order
            break;
          }
        }
        set((state) => {
          state.offlineQueue = state.offlineQueue.filter(req => !successfullySynced.includes(req.id));
        });
        if (successfullySynced.length > 0) {
          toast.success(`${successfullySynced.length} submission(s) synced successfully.`);
        }
      },
    })),
    {
      name: 'data-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ offlineQueue: state.offlineQueue }), // Only persist the offline queue
    }
  )
);
// Listen to online/offline events
window.addEventListener('online', () => useDataStore.getState().setOnlineStatus(true));
window.addEventListener('offline', () => useDataStore.getState().setOnlineStatus(false));
// Selectors
export const useSubmissions = () => useDataStore((state) => state.submissions);
export const useIsLoadingData = () => useDataStore((state) => state.isLoading);
export const useLatestComplianceStatus = (): ComplianceStatus | null => {
  const submissions = useSubmissions();
  if (submissions.length === 0) return null;
  const latest = submissions[0]; // Already sorted
  return {
    status: latest.status,
    solvencyRatio: latest.solvencyRatio,
    capital: latest.capital,
    liabilities: latest.liabilities,
    lastCheck: latest.date,
  };
};