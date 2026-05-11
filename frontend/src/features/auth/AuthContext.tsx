import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../lib/api";
import type { User } from "../../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; fullName?: string }) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  linkGoogleAccount: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch (_error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  const login = async (payload: { email: string; password: string }) => {
    const { data } = await api.post<{ user: User }>("/auth/login", payload);
    setUser(data.user);
  };

  const register = async (payload: { email: string; password: string; fullName?: string }) => {
    const { data } = await api.post<{ user: User }>("/auth/register", payload);
    setUser(data.user);
  };

  const loginWithGoogle = async (credential: string) => {
    const { data } = await api.post<{ user: User }>("/auth/google", { credential });
    setUser(data.user);
  };

  const linkGoogleAccount = async (credential: string) => {
    const { data } = await api.post<{ user: User }>("/auth/google/link", { credential });
    setUser(data.user);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      loginWithGoogle,
      linkGoogleAccount,
      logout,
      refreshUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
