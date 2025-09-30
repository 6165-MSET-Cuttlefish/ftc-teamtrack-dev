/**
 * Safe API utilities with error handling and retry logic
 */

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

export class SafeApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL = '/api', headers: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        const error: ApiError = new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.code = errorData.code;
        
        return { success: false, error };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      const apiError: ApiError = new Error(
        error instanceof Error ? error.message : 'Network error occurred'
      );
      return { success: false, error: apiError };
    }
  }

  async get<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: { ...this.defaultHeaders, ...options.headers },
        ...options,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      const apiError: ApiError = new Error(
        error instanceof Error ? error.message : 'Network request failed'
      );
      return { success: false, error: apiError };
    }
  }

  async post<T>(
    endpoint: string, 
    data?: unknown, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: { ...this.defaultHeaders, ...options.headers },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      const apiError: ApiError = new Error(
        error instanceof Error ? error.message : 'Network request failed'
      );
      return { success: false, error: apiError };
    }
  }

  async put<T>(
    endpoint: string, 
    data?: unknown, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: { ...this.defaultHeaders, ...options.headers },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      const apiError: ApiError = new Error(
        error instanceof Error ? error.message : 'Network request failed'
      );
      return { success: false, error: apiError };
    }
  }

  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: { ...this.defaultHeaders, ...options.headers },
        ...options,
      });
      
      return this.handleResponse<T>(response);
    } catch (error) {
      const apiError: ApiError = new Error(
        error instanceof Error ? error.message : 'Network request failed'
      );
      return { success: false, error: apiError };
    }
  }
}

// Default client instance
export const apiClient = new SafeApiClient();

// Utility for retrying failed requests
export async function withRetry<T>(
  operation: () => Promise<ApiResponse<T>>,
  maxRetries = 3,
  delayMs = 1000
): Promise<ApiResponse<T>> {
  let lastError: ApiError | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await operation();
    
    if (result.success) {
      return result;
    }

    lastError = result.error;

    // Don't retry on client errors (4xx)
    if (result.error?.status && result.error.status >= 400 && result.error.status < 500) {
      break;
    }

    // Wait before retrying (except on last attempt)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }

  return { success: false, error: lastError || new Error('Operation failed after retries') };
}