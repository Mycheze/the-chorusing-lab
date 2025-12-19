"use client";

import { useState } from "react";
import {
  UserPlus,
  User,
  Lock,
  AlertCircle,
  CheckCircle,
  Mail,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { RegisterCredentials } from "@/types/auth";

interface RegisterFormProps {
  onToggleMode: () => void;
  onSuccess?: () => void;
}

export function RegisterForm({ onToggleMode, onSuccess }: RegisterFormProps) {
  const { register, isLoading, error } = useAuth();
  const [credentials, setCredentials] = useState<RegisterCredentials>({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [validations, setValidations] = useState({
    emailValid: false,
    usernameLength: false,
    passwordLength: false,
    passwordsMatch: false,
  });

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await register(credentials);
      onSuccess?.();
    } catch (error) {
      // Error is handled by auth context
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newCredentials = { ...credentials, [name]: value };
    setCredentials(newCredentials);

    // Update validations
    setValidations({
      emailValid: isValidEmail(newCredentials.email),
      usernameLength: newCredentials.username.length >= 3,
      passwordLength: newCredentials.password.length >= 6,
      passwordsMatch:
        newCredentials.password === newCredentials.confirmPassword &&
        newCredentials.password.length > 0,
    });
  };

  const isFormValid =
    validations.emailValid &&
    validations.usernameLength &&
    validations.passwordLength &&
    validations.passwordsMatch;

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <UserPlus className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-900">Sign Up</h2>
        </div>
        <p className="text-gray-600">Join Chorus Lab to start uploading</p>
      </div>

      {error && (
        <div
          className={`mb-4 p-3 border rounded-md flex items-center gap-2 ${
            error.includes("check your email") || error.includes("confirm")
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              id="email"
              name="email"
              value={credentials.email}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="your.email@example.com"
            />
            {credentials.email && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {validations.emailValid ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            You&apos;ll use this to sign in and for account verification
          </p>
        </div>

        {/* Username Field */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Choose a username"
            />
            {credentials.username && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {validations.usernameLength ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            At least 3 characters, can also be used to sign in
          </p>
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Create a password"
            />
            {credentials.password && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {validations.passwordLength ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
        </div>

        {/* Confirm Password Field */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={credentials.confirmPassword}
              onChange={handleChange}
              required
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Confirm your password"
            />
            {credentials.confirmPassword && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {validations.passwordsMatch ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Must match your password</p>
        </div>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Create Account
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{" "}
          <button
            onClick={onToggleMode}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
