/**
 * Utility functions for API routes
 * Provides consistent error handling and response formatting
 */

import { NextResponse } from "next/server";

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  code?: string,
  details?: unknown
): NextResponse<ApiError> {
  const response: ApiError = {
    error,
  };

  if (code) {
    response.code = code;
  }

  if (details !== undefined) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Handles errors in API routes with consistent formatting
 */
export function handleApiError(error: unknown): NextResponse<ApiError> {
  console.error("API Error:", error);

  if (error instanceof Error) {
    // Handle known error types
    if (
      error.message.includes("authentication") ||
      error.message.includes("auth")
    ) {
      return createErrorResponse(error.message, 401, "AUTH_ERROR");
    }
    if (error.message.includes("not found")) {
      return createErrorResponse(error.message, 404, "NOT_FOUND");
    }
    if (
      error.message.includes("validation") ||
      error.message.includes("invalid")
    ) {
      return createErrorResponse(error.message, 400, "VALIDATION_ERROR");
    }

    return createErrorResponse(error.message, 500, "INTERNAL_ERROR");
  }

  return createErrorResponse(
    "An unexpected error occurred",
    500,
    "UNKNOWN_ERROR",
    error
  );
}

/**
 * Validates required environment variables
 */
export function validateEnvVars(required: string[]): void {
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key] === ""
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
