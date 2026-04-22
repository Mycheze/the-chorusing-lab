/**
 * Utility functions for API routes
 * Provides retry logic and transient error detection
 */

/**
 * Determines if an error is transient and should be retried
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.code || error.statusCode || '';
  
  // Network/connection errors
  if (
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('timeout') ||
    errorCode === 'UND_ERR_CONNECT_TIMEOUT' ||
    errorCode === 'UND_ERR_SOCKET'
  ) {
    return true;
  }
  
  // HTTP 5xx errors (server errors)
  if (errorCode >= 500 && errorCode < 600) {
    return true;
  }
  
  // Rate limiting (429)
  if (errorCode === 429) {
    return true;
  }
  
  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if it's not a transient error
      if (!isTransientError(error)) {
        throw error;
      }
      
      // Don't retry on final attempt
      if (attempt >= maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      
      if (onRetry) {
        onRetry(attempt + 1, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}
