import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { User, UserRole } from '@/lib/types';
import { MOCK_USERS } from '@/lib/mockData';
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  users: User[];
  login: (username: string, role: UserRole) => boolean;
  logout: () => void;
  signup: (data: { username: string; businessName: string; registrationNumber: string }) => void;
}
export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      isAuthenticated: false,
      user: null,
      users: MOCK_USERS,
      login: (username, role) => {
        const foundUser = get().users.find(
          (u) => u.username.toLowerCase() === username.toLowerCase() && u.role === role
        );
        if (foundUser) {
          set({ isAuthenticated: true, user: foundUser });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ isAuthenticated: false, user: null });
      },
      signup: (data) => {
        const existingUser = get().users.find(u => u.username.toLowerCase() === data.username.toLowerCase());
        if (existingUser) {
          throw new Error("An account with this email already exists.");
        }
        const newUser: User = {
          id: `user-${Date.now()}`,
          username: data.username,
          role: 'Insurer',
          businessName: data.businessName,
          registrationNumber: data.registrationNumber,
        };
        set(state => {
          state.users.push(newUser);
        });
      },
    })),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        // Do not persist the full user list in session storage for security/size reasons
      }),
    }
  )
);