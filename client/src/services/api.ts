const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });
    } catch (err) {
      // Network or CORS error — provide a clearer message
      // If this was a sessions GET, fallback to empty list to avoid crashing the UI in preview environments
      const method = options?.method?.toString().toUpperCase() || 'GET';
      if (method === 'GET' && endpoint.startsWith('/sessions')) {
        return [] as unknown as T;
      }
      throw new Error(`Network request failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      // For sessions GET, return empty list on server errors as well
      const method = options?.method?.toString().toUpperCase() || 'GET';
      if (method === 'GET' && endpoint.startsWith('/sessions')) {
        return [] as unknown as T;
      }
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch (err) {
      // If parsing sessions list fails, return empty list
      if (endpoint.startsWith('/sessions')) {
        return [] as unknown as T;
      }
      throw new Error(`Failed to parse JSON from ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Session API calls matching your backend endpoints
  async createSession(sessionData: Record<string, unknown>) {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getSessions(userId?: string) {
    const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request(`/sessions${params}`);
  }

  async getSession(id: string) {
    return this.request(`/sessions/${id}`);
  }

  async getAllSessions() {
    return this.request('/sessions/view/all');
  }
}

export const apiService = new ApiService();
