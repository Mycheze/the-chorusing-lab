"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { supabase } from "@/lib/supabase";
import type {
  AuthContextType,
  AuthState,
  LoginCredentials,
  RegisterCredentials,
  User,
} from "@/types/auth";
import type { Session } from "@supabase/supabase-js";

interface ExtendedAuthContextType extends AuthContextType {
  session: Session | null;
  getAuthHeaders: () => HeadersInit;
}

const AuthContext = createContext<ExtendedAuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true, // Start loading to prevent flashing
    error: null,
  });
  const [session, setSession] = useState<Session | null>(null);

  // Use a ref to track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Helper to check if a string is an email
  const isEmail = (input: string): boolean => {
    return input.includes("@") && input.includes(".");
  };

  // Convert Supabase session to our User type
  const sessionToUser = useCallback(
    async (session: Session | null): Promise<User | null> => {
      if (!session?.user) {
        return null;
      }

      try {
        // Get user profile from our profiles table
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("username, email")
          .eq("id", session.user.id)
          .maybeSingle();

        let username = session.user.user_metadata?.username || "Unknown";
        let email =
          session.user.email || session.user.user_metadata?.email || "Unknown";

        if (profile) {
          username = profile.username;
          email = profile.email;
        } else if (error) {
          // If generic error or not found, try to use metadata fallback
          console.warn(
            "Could not fetch profile, using metadata fallback",
            error
          );

          // Only attempt creation if we have the data and it seems like a missing profile issue
          if (session.user.user_metadata?.username && !profile) {
            try {
              await supabase.from("profiles").upsert(
                {
                  id: session.user.id,
                  username: session.user.user_metadata.username,
                  email: email,
                },
                { onConflict: "id", ignoreDuplicates: true }
              );
            } catch (e) {
              console.warn("Auto-creation of profile failed", e);
            }
          }
        }

        // Check admin status non-blocking
        let isAdminUser = false;
        try {
          // We already have the session token, no need to fetch session again
          if (session.access_token) {
            const response = await fetch("/api/auth/admin-status", {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            if (response.ok) {
              const data = await response.json();
              isAdminUser = data.isAdmin || false;
            }
          }
        } catch (adminError) {
          console.warn("Failed to check admin status:", adminError);
        }

        return {
          id: session.user.id,
          username,
          email,
          createdAt: session.user.created_at,
          isAdmin: isAdminUser,
        };
      } catch (err) {
        console.error("Error in sessionToUser:", err);
        // Fallback to basic info from session to avoid locking user out
        return {
          id: session.user.id,
          username: session.user.user_metadata?.username || "Unknown",
          email: session.user.email || "Unknown",
          createdAt: session.user.created_at,
          isAdmin: false,
        };
      }
    },
    []
  );

  // FIXED: Memoize auth headers to return stable object references
  const getAuthHeaders = useMemo((): (() => HeadersInit) => {
    // Create stable header objects
    const emptyHeaders = {};
    const authHeaders = session?.access_token
      ? {
          Authorization: `Bearer ${session.access_token}`,
        }
      : emptyHeaders;

    // Return a function that always returns the same object reference
    return () => authHeaders;
  }, [session?.access_token]);

  // Handle auth state changes
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        const user = await sessionToUser(initialSession);

        if (mounted) {
          setSession(initialSession);
          setAuthState({
            user,
            isLoading: false,
            error: null,
          });
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        if (mounted) {
          setAuthState({
            user: null,
            isLoading: false,
            error: err.message || "Failed to initialize auth",
          });
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // If the session is effectively the same, don't trigger a full re-conversion
      // This helps avoid loops, though strict equality check on objects might fail unrelatedly
      // handled by internal React state diffing mostly.

      console.log("Auth state change:", event);

      // We generally trust the event session, but verify it
      const user = await sessionToUser(currentSession);

      if (mounted) {
        setSession(currentSession);
        setAuthState({
          user,
          isLoading: false,
          error: null,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [sessionToUser]);

  const login = async (credentials: LoginCredentials) => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;
      if (!data.session) throw new Error("No session returned from login");

      // We do NOT wait for onAuthStateChange here to stop loading.
      // We manually ensure state is updated to be responsive.
      // onAuthStateChange will eventually fire and reconcile, but we want immediate feedback.

      // const user = await sessionToUser(data.session);
      // setSession(data.session);
      // setAuthState({
      //   user,
      //   isLoading: false,
      //   error: null
      // });

      // Actually, relying on onAuthStateChange IS safer for consistency,
      // BUThit often lags.
      // Optimistic update:
      console.log("Login successful, awaiting state update...");
    } catch (error: any) {
      console.error("Login failed:", error);
      let errorMessage = error.message || "Login failed";

      if (errorMessage.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password";
      }

      setAuthState({
        user: null,
        isLoading: false,
        error: errorMessage,
      });
      throw error; // Re-throw so UI can handle it
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (credentials.password !== credentials.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      // Check if username/email exists logic (simplified for brevity, assume relying on DB constraints or pre-checks)
      // For a robust refactor, keeping the pre-checks is good UX.
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", credentials.username)
        .maybeSingle();
      if (existingProfile) throw new Error("Username already taken");

      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            username: credentials.username,
            email: credentials.email,
          },
        },
      });

      if (error) throw error;

      // Check if email confirmation is required
      if (data.user && !data.session) {
        setAuthState({
          user: null,
          isLoading: false,
          error: "Please check your email to confirm your account.",
        });
        return;
      }

      // If we have a session, success. onAuthStateChange will handle the rest.
    } catch (error: any) {
      console.error("Registration failed:", error);
      setAuthState({
        user: null,
        isLoading: false,
        error: error.message || "Registration failed",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      // State update handled by onAuthStateChange
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const value: ExtendedAuthContextType = {
    ...authState,
    session,
    login,
    register,
    logout,
    getAuthHeaders,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
