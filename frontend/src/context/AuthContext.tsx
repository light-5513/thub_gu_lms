import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import type { Role } from "@/types";

interface Session {
  id: string;
  email: string;
  role: Role;
  full_name?: string | null;
  must_change_password: boolean;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  refreshSession: () => Promise<Session | null>;
  setSession: (s: Session | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  refreshSession: async () => null,
  setSession: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await api.get<Session>("/auth/me");
      setSession(data);
      return data;
    } catch {
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  return <AuthContext.Provider value={{ session, loading, refreshSession, setSession }}>{children}</AuthContext.Provider>;
}
