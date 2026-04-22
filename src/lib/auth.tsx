"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import type { AuthContextType, User } from "@/types/auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!response.ok) {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        const data = await response.json();

        if (mounted) {
          if (data.user) {
            setUser(data.user);
          } else {
            setUser(null);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Auth session check failed:", err);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
          setError(
            err instanceof Error ? err.message : "Failed to check auth session"
          );
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback((_credentials?: unknown) => {
    window.location.href = "/api/auth/sso";
  }, []);

  const register = useCallback(async (_credentials?: unknown) => {
    window.location.href = "/api/auth/sso";
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }, []);

  const isAuthenticated = user !== null;

  const value: AuthContextType = useMemo(
    () => ({
      user,
      isLoading,
      error,
      isAuthenticated,
      login,
      register,
      logout,
    }),
    [user, isLoading, error, isAuthenticated, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
