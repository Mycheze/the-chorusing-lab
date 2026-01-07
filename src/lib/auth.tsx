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
import { supabaseMonitor } from "@/lib/supabase-monitor";
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

// Cache for admin status to avoid repeated API calls
const adminStatusCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
const ADMIN_STATUS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  // Check admin status with caching
  const checkAdminStatus = useCallback(
    async (userId: string, accessToken: string): Promise<boolean> => {
      // Check cache first
      const cached = adminStatusCache.get(userId);
      if (cached && Date.now() - cached.timestamp < ADMIN_STATUS_CACHE_TTL) {
        return cached.isAdmin;
      }

      try {
        const response = await fetch("/api/auth/admin-status", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          const isAdmin = data.isAdmin || false;
          // Cache the result
          adminStatusCache.set(userId, {
            isAdmin,
            timestamp: Date.now(),
          });
          return isAdmin;
        }
      } catch (adminError) {
        console.warn("Failed to check admin status:", adminError);
      }

      return false;
    },
    []
  );

  // Convert Supabase session to our User type
  // Now with parallelized operations and optional admin status check
  const sessionToUser = useCallback(
    async (
      session: Session | null,
      options: { skipAdminCheck?: boolean } = {}
    ): Promise<User | null> => {
      if (!session?.user) {
        return null;
      }

      try {
        // Parallelize profile fetch and admin status check
        const profileStart = Date.now();
        const profilePromise = supabase
          .from("profiles")
          .select("username, email")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(result => {
            const profileDuration = Date.now() - profileStart;
            supabaseMonitor.logRequest({
              type: 'database',
              operation: 'getProfile',
              duration: profileDuration,
              status: result.error ? 'failure' : 'success',
              error: result.error?.message,
              errorCode: result.error?.code,
            });
            return result;
          });

        const adminPromise = options.skipAdminCheck
          ? Promise.resolve(false)
          : session.access_token
            ? checkAdminStatus(session.user.id, session.access_token)
            : Promise.resolve(false);

        // Wait for both in parallel
        const [profileResult, isAdminUser] = await Promise.all([
          profilePromise,
          adminPromise,
        ]);

        const { data: profile, error } = profileResult;

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
    [checkAdminStatus]
  );

  // Memoize auth headers function to return stable object references
  const getAuthHeaders = useCallback((): HeadersInit => {
    // Return headers directly based on current session
    if (session?.access_token) {
      return {
        Authorization: `Bearer ${session.access_token}`,
      };
    }
    return {};
  }, [session?.access_token]);

  // Handle auth state changes
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Helper function to get session with timeout and retry logic
        const getSessionWithRetry = async (retryCount = 0): Promise<{ session: Session | null; error: any }> => {
          const requestId = supabaseMonitor.startRequest('auth', 'getSession');
          const timeoutMs = retryCount === 0 ? 15000 : 5000; // 15s first attempt, 5s retry
          
          try {
            const result = await Promise.race([
              supabase.auth.getSession(),
              new Promise<never>((_, reject) =>
                setTimeout(() => {
                  supabaseMonitor.timeoutRequest(requestId, timeoutMs);
                  reject(new Error('Auth operation timeout'));
                }, timeoutMs)
              ),
            ]);
            
            const inFlight = (supabaseMonitor as any).inFlightRequests.get(requestId);
            const duration = inFlight ? Date.now() - inFlight.startTime : 0;
            
            supabaseMonitor.completeRequest(requestId, {
              type: 'auth',
              operation: 'getSession',
              duration,
              status: result.error ? 'failure' : 'success',
              error: result.error?.message,
              errorCode: result.error?.status?.toString(),
            });
            
            return { session: result.data.session, error: result.error };
          } catch (timeoutError: any) {
            const inFlight = (supabaseMonitor as any).inFlightRequests.get(requestId);
            const duration = inFlight ? Date.now() - inFlight.startTime : 0;
            
            if (timeoutError?.message === 'Auth operation timeout') {
              // If first attempt timed out, retry once
              if (retryCount === 0) {
                console.warn('Auth getSession() timed out, retrying...');
                return getSessionWithRetry(1);
              }
              // Both attempts failed
              supabaseMonitor.completeRequest(requestId, {
                type: 'auth',
                operation: 'getSession',
                duration,
                status: 'failure',
                error: 'Auth operation timeout (after retry)',
              });
              return { session: null, error: timeoutError };
            } else {
              // Unexpected error - log it
              supabaseMonitor.completeRequest(requestId, {
                type: 'auth',
                operation: 'getSession',
                duration,
                status: 'failure',
                error: timeoutError?.message || 'Unknown error',
                errorCode: timeoutError?.status?.toString(),
              });
              return { session: null, error: timeoutError };
            }
          }
        };
        
        // Get initial session with retry logic
        const { session: initialSession, error } = await getSessionWithRetry();

        if (error) {
          throw error;
        }

        // If we have a session, update state optimistically first
        if (initialSession?.access_token) {
          // Update state immediately with basic info from session
          const optimisticUser: User = {
            id: initialSession.user.id,
            username:
              initialSession.user.user_metadata?.username || "Unknown",
            email: initialSession.user.email || "Unknown",
            createdAt: initialSession.user.created_at,
            isAdmin: false, // Will be updated when full check completes
          };

          if (mounted) {
            setSession(initialSession);
            setAuthState({
              user: optimisticUser,
              isLoading: false, // Stop loading immediately
              error: null,
            });
          }

          // Then verify and update with full profile/admin status in background
          const fullUser = await sessionToUser(initialSession);
          if (mounted && fullUser) {
            setAuthState((prev) => ({
              ...prev,
              user: fullUser,
            }));
          }
        } else {
          // No session, we're done
          if (mounted) {
            setSession(null);
            setAuthState({
              user: null,
              isLoading: false,
              error: null,
            });
          }
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

    // Listen for auth changes - update immediately for reliability
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      console.log("Auth state change:", event);

      // For token refresh events, skip admin check to speed things up
      const skipAdminCheck = event === "TOKEN_REFRESHED";

      // Update session immediately
      if (mounted) {
        setSession(currentSession);
      }

      // If we have a session, update user info
      if (currentSession?.access_token) {
        // For SIGNED_IN events, show optimistic update first
        if (event === "SIGNED_IN" && mounted) {
          const optimisticUser: User = {
            id: currentSession.user.id,
            username:
              currentSession.user.user_metadata?.username || "Unknown",
            email: currentSession.user.email || "Unknown",
            createdAt: currentSession.user.created_at,
            isAdmin: false,
          };
          setAuthState({
            user: optimisticUser,
            isLoading: false,
            error: null,
          });
        }

        // Then get full user info (with optional admin check)
        const user = await sessionToUser(currentSession, {
          skipAdminCheck,
        });

        if (mounted) {
          setAuthState({
            user,
            isLoading: false,
            error: null,
          });
        }
      } else {
        // No session (signed out)
        if (mounted) {
          setAuthState({
            user: null,
            isLoading: false,
            error: null,
          });
          // Clear admin cache on logout
          adminStatusCache.clear();
        }
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
      const requestId = supabaseMonitor.startRequest('auth', 'signInWithPassword');
      const timeoutMs = 15000; // 15 seconds
      
      let data, error;
      try {
        const result = await Promise.race([
          supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              supabaseMonitor.timeoutRequest(requestId, timeoutMs);
              reject(new Error('Login timeout'));
            }, timeoutMs)
          ),
        ]);
        data = result.data;
        error = result.error;
      } catch (timeoutError: any) {
        if (timeoutError?.message === 'Login timeout') {
          throw timeoutError;
        }
        throw timeoutError;
      }
      
      const inFlight = (supabaseMonitor as any).inFlightRequests.get(requestId);
      const duration = inFlight ? Date.now() - inFlight.startTime : 0;
      
      if (inFlight) {
        supabaseMonitor.completeRequest(requestId, {
          type: 'auth',
          operation: 'signInWithPassword',
          duration,
          status: error ? 'failure' : 'success',
          error: error?.message,
          errorCode: error?.status?.toString(),
        });
      }

      if (error) throw error;
      if (!data.session) throw new Error("No session returned from login");

      // Optimistic update: immediately update state with session data
      // This provides instant feedback while onAuthStateChange reconciles in background
      const optimisticUser: User = {
        id: data.session.user.id,
        username: data.session.user.user_metadata?.username || "Unknown",
        email: data.session.user.email || credentials.email,
        createdAt: data.session.user.created_at,
        isAdmin: false, // Will be updated when full check completes
      };

      setSession(data.session);
      setAuthState({
        user: optimisticUser,
        isLoading: false, // Stop loading immediately
        error: null,
      });

      // Fetch full user info in background (profile + admin status)
      // onAuthStateChange will also fire and reconcile, but we have immediate feedback
      sessionToUser(data.session)
        .then((fullUser) => {
          if (fullUser && isMounted.current) {
            setAuthState((prev) => ({
              ...prev,
              user: fullUser,
            }));
          }
        })
        .catch((err) => {
          console.warn("Background user fetch failed:", err);
          // Don't update state on error - optimistic update is fine
        });
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
      const profileCheckStart = Date.now();
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", credentials.username)
        .maybeSingle();
      const profileCheckDuration = Date.now() - profileCheckStart;
      
      supabaseMonitor.logRequest({
        type: 'database',
        operation: 'checkUsernameExists',
        duration: profileCheckDuration,
        status: 'success',
      });
      
      if (existingProfile) throw new Error("Username already taken");

      const signUpStart = Date.now();
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
      const signUpDuration = Date.now() - signUpStart;
      
      supabaseMonitor.logRequest({
        type: 'auth',
        operation: 'signUp',
        duration: signUpDuration,
        status: error ? 'failure' : 'success',
        error: error?.message,
        errorCode: error?.status?.toString(),
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

      // If we have a session, update state optimistically
      if (data.session) {
        const optimisticUser: User = {
          id: data.session.user.id,
          username: credentials.username, // We know this from registration
          email: credentials.email,
          createdAt: data.session.user.created_at,
          isAdmin: false, // Will be updated when full check completes
        };

        setSession(data.session);
        setAuthState({
          user: optimisticUser,
          isLoading: false, // Stop loading immediately
          error: null,
        });

        // Fetch full user info in background (profile + admin status)
        // onAuthStateChange will also fire and reconcile, but we have immediate feedback
        sessionToUser(data.session)
          .then((fullUser) => {
            if (fullUser && isMounted.current) {
              setAuthState((prev) => ({
                ...prev,
                user: fullUser,
              }));
            }
          })
          .catch((err) => {
            console.warn("Background user fetch failed:", err);
            // Don't update state on error - optimistic update is fine
          });
      }
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
