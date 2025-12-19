"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
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
    isLoading: false, // EMERGENCY: Set to false immediately
    error: null,
  });
  const [session, setSession] = useState<Session | null>(null);

  // Helper to check if a string is an email
  const isEmail = (input: string): boolean => {
    return input.includes("@") && input.includes(".");
  };

  // Convert Supabase session to our User type
  const sessionToUser = async (
    session: Session | null
  ): Promise<User | null> => {
    if (!session?.user) {
      console.log("No session or user found");
      return null;
    }

    try {
      console.log("Converting session to user for:", session.user.id);

      // Get user profile from our profiles table
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Failed to fetch user profile:", error);
        // If profile doesn't exist, try to create it from user metadata
        // This handles edge cases where profile creation might have failed
        const username = session.user.user_metadata?.username;
        const email = session.user.email || session.user.user_metadata?.email;

        if (username && email) {
          console.log("Attempting to create missing profile...");
          const { error: createError } = await supabase
            .from("profiles")
            .insert({
              id: session.user.id,
              username,
              email,
            });

          if (!createError) {
            // Profile created, check admin status and return the user
            let isAdminUser = false;
            try {
              const {
                data: { session: currentSession },
              } = await supabase.auth.getSession();
              if (currentSession?.access_token) {
                const response = await fetch("/api/auth/admin-status", {
                  headers: {
                    Authorization: `Bearer ${currentSession.access_token}`,
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
          }
        }

        // Fallback: return basic user info from metadata
        let isAdminUser = false;
        try {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          if (currentSession?.access_token) {
            const response = await fetch("/api/auth/admin-status", {
              headers: {
                Authorization: `Bearer ${currentSession.access_token}`,
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
          username: session.user.user_metadata?.username || "Unknown",
          email:
            session.user.email ||
            session.user.user_metadata?.email ||
            "Unknown",
          createdAt: session.user.created_at,
          isAdmin: isAdminUser,
        };
      }

      if (!profile) {
        console.warn("No profile found for user");
        let isAdminUser = false;
        try {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          if (currentSession?.access_token) {
            const response = await fetch("/api/auth/admin-status", {
              headers: {
                Authorization: `Bearer ${currentSession.access_token}`,
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
          username: session.user.user_metadata?.username || "Unknown",
          email:
            session.user.email ||
            session.user.user_metadata?.email ||
            "Unknown",
          createdAt: session.user.created_at,
          isAdmin: isAdminUser,
        };
      }

      console.log("Successfully converted session to user:", profile.username);

      // Check admin status
      let isAdminUser = false;
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        if (currentSession?.access_token) {
          const response = await fetch("/api/auth/admin-status", {
            headers: {
              Authorization: `Bearer ${currentSession.access_token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            isAdminUser = data.isAdmin || false;
          }
        }
      } catch (adminError) {
        console.warn("Failed to check admin status:", adminError);
        // Continue without admin status if check fails
      }

      return {
        id: session.user.id,
        username: profile.username,
        email: profile.email,
        createdAt: session.user.created_at,
        isAdmin: isAdminUser,
      };
    } catch (err) {
      console.error("Error in sessionToUser:", err);
      return null;
    }
  };

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
  }, [session?.access_token]); // Only recreate when access token changes

  // Handle auth state changes
  useEffect(() => {
    console.log("AuthProvider: Setting up auth state monitoring");

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log("AuthProvider: Getting initial session");
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          setAuthState({
            user: null,
            isLoading: false,
            error: error.message,
          });
          setSession(null);
          return;
        }

        console.log(
          "AuthProvider: Initial session result:",
          session ? "Session found" : "No session"
        );
        setSession(session);

        const user = await sessionToUser(session);
        console.log(
          "AuthProvider: User conversion result:",
          user ? `User: ${user.username}` : "No user"
        );

        setAuthState({
          user,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error("Error in getInitialSession:", err);
        setAuthState({
          user: null,
          isLoading: false,
          error: "Failed to initialize authentication",
        });
        setSession(null);
      }
    };

    getInitialSession();

    // Listen for auth changes
    console.log("AuthProvider: Setting up auth state change listener");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "Auth state changed:",
        event,
        session ? "Session exists" : "No session"
      );

      try {
        setSession(session);
        const user = await sessionToUser(session);

        setAuthState((prev) => ({
          ...prev,
          user,
          isLoading: false,
          error: null,
        }));
      } catch (err) {
        console.error("Error handling auth state change:", err);
        setAuthState((prev) => ({
          ...prev,
          user: null,
          isLoading: false,
          error: "Authentication error",
        }));
      }
    });

    return () => {
      console.log("AuthProvider: Cleaning up auth listener");
      subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    console.log("AuthProvider: Login attempt for:", credentials.email);
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Sign in with email/password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        console.error("Login error:", error);
        throw error;
      }

      if (!data.session) {
        throw new Error("Login failed - no session created");
      }

      console.log("Login successful for:", credentials.email);
      // User state will be updated by the onAuthStateChange listener
    } catch (error: any) {
      console.error("Login failed:", error);
      let errorMessage = "Login failed";

      // Handle network errors
      if (
        error.message?.includes("NetworkError") ||
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("Network request failed")
      ) {
        errorMessage =
          "Cannot connect to server. Your Supabase project might be paused. Please check your Supabase dashboard.";
      } else if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage =
          "Please check your email and confirm your account before signing in.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setAuthState({
        user: null,
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    console.log(
      "AuthProvider: Register attempt for:",
      credentials.username,
      credentials.email
    );
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (credentials.password !== credentials.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (credentials.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (credentials.username.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }

      // Basic email validation
      if (!isEmail(credentials.email)) {
        throw new Error("Please enter a valid email address");
      }

      // Check if username already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", credentials.username)
        .single();

      if (existingProfile) {
        throw new Error("Username already exists");
      }

      // Check if email already exists
      const { data: existingEmail } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", credentials.email)
        .single();

      if (existingEmail) {
        throw new Error("Email already exists");
      }

      // Sign up with email/password
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

      if (error) {
        console.error("Registration error:", error);
        throw error;
      }

      if (!data.user) {
        throw new Error("Failed to create user account");
      }

      // Note: Profile will be created automatically by the database trigger
      // But we'll create it manually as a backup in case the trigger fails
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username: credentials.username,
        email: credentials.email,
      });

      // If profile creation fails, it might already exist (from trigger) - that's okay
      if (
        profileError &&
        !profileError.message.includes("duplicate") &&
        !profileError.message.includes("violates unique constraint")
      ) {
        console.warn(
          "Profile creation warning (might be from trigger):",
          profileError
        );
        // Don't throw - the trigger might have created it
      }

      // Handle email confirmation requirement
      if (!data.session) {
        // Email confirmation is required - this is normal!
        // Set a success state instead of error
        setAuthState({
          user: null,
          isLoading: false,
          error:
            "Please check your email to confirm your account. You'll be logged in automatically after confirmation.",
        });
        // Don't throw - this is expected behavior when email confirmation is enabled
        return;
      }

      console.log(
        "Registration successful for:",
        credentials.username,
        credentials.email
      );
      // User state will be updated by the onAuthStateChange listener
    } catch (error: any) {
      console.error("Registration failed:", error);
      let errorMessage = "Registration failed";

      if (error.message?.includes("already registered")) {
        errorMessage = "This email is already taken";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setAuthState({
        user: null,
        isLoading: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    console.log("AuthProvider: Logout attempt");
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
    } else {
      console.log("Logout successful");
    }

    // User state will be updated by the onAuthStateChange listener
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
