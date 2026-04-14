// Authentication types for Chorus Lab

export interface User {
  id: string; // UUID from profiles.id (internal primary key)
  refoldId?: number; // Refold SSO user ID (profiles.refold_id)
  username: string;
  email: string;
  createdAt: string;
  isAdmin?: boolean;
}

/**
 * @deprecated SSO replaces email/password login. Kept temporarily for
 * backward compatibility with existing AuthProvider (will be removed when
 * the frontend auth is migrated).
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * @deprecated SSO replaces email/password registration. Kept temporarily for
 * backward compatibility with existing AuthProvider (will be removed when
 * the frontend auth is migrated).
 */
export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
}
