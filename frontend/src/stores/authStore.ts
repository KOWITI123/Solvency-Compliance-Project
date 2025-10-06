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
  loginWithUserData: (userData: any) => boolean; // ← ADD THIS NEW METHOD
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
        console.log('AuthStore login attempt:', { username, role });
        console.log('Available users:', MOCK_USERS.map(u => ({ username: u.username, role: u.role })));
        
        const foundUser = get().users.find(
          (u) => u.username.toLowerCase() === username.toLowerCase() && u.role === role
        );
        
        console.log('Found user:', foundUser);
        
        if (foundUser) {
          set({ isAuthenticated: true, user: foundUser });
          console.log('Login successful, state updated');
          return true;
        }
        
        console.log('Login failed - user not found in mock data');
        return false;
      },
      
      // ✅ ADD THIS NEW METHOD for database users
      loginWithUserData: (userData) => {
        console.log('AuthStore loginWithUserData:', userData);
        
        // Create a User object from database data
        const user: User = {
          id: userData.id.toString(),
          username: userData.username || userData.email,
          role: userData.role === 'insurer' ? 'Insurer' : 
                userData.role === 'regulator' ? 'Regulator' : 
                userData.role === 'admin' ? 'Admin' : 'Insurer',
          businessName: userData.email, // Use email as business name for now
          registrationNumber: userData.id.toString(),
        };
        
        set({ isAuthenticated: true, user: user });
        console.log('Database user login successful');
        return true;
      },
      
      logout: () => {
        console.log('Logout called');
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