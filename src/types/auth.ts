// Authentication types for Chorus Lab

export interface User {
  id: string; // UUID from profiles.id (internal primary key)
  refoldId?: number; // Refold SSO user ID (profiles.refold_id)
  username: string;
  email: string;
  /** @deprecated Not included in SSO session. Kept for server-database.ts compatibility. */
  createdAt?: string;
  isAdmin?: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  isAuthenticated: boolean;
  login: (credentials?: any) => void;
  register: (credentials?: any) => Promise<void>;
  logout: () => void;
  getAuthHeaders: () => HeadersInit;
}
