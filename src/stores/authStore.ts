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
        console.log('AuthStore login attempt:', { username, role }); // Debug log
        console.log('Available users:', MOCK_USERS.map(u => ({ username: u.username, role: u.role }))); // Debug log
        
        const foundUser = get().users.find(
          (u) => u.username.toLowerCase() === username.toLowerCase() && u.role === role
        );
        
        console.log('Found user:', foundUser); // Debug log
        
        if (foundUser) {
          set({ isAuthenticated: true, user: foundUser });
          console.log('Login successful, state updated'); // Debug log
          return true;
        }
        
        console.log('Login failed - user not found'); // Debug log
        return false;
      },
      
      logout: () => {
        console.log('Logout called'); // Debug log
        set({ isAuthenticated: false, user: null });
      },
      
      signup: (data) => {
        const existingUser = get().users.find(u => u.username.toLowerCase() === data.username.toLowerCase());
        if (existingUser) {
          throw new Error('User already exists');
        }
        
        const newUser: User = {
          id: Date.now().toString(),
          username: data.username,
          role: 'Insurer',
          businessName: data.businessName,
          registrationNumber: data.registrationNumber,
        };
        
        set(state => {
          state.users.push(newUser);
          state.isAuthenticated = true;
          state.user = newUser;
        });
      },
    })),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
);