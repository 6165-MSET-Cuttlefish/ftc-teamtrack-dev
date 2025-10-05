const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getApiBase() {
  const g = globalThis as any;
  if (g.__API_BASE) return g.__API_BASE;
  const val = import.meta.env.VITE_API_URL || '/api';
  g.__API_BASE = val;
  return val;
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;

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
    try {
      return await this.request('/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData),
      });
    } catch (err) {
      console.error('createSession failed', err);
      return null;
    }
  }

  async getSessions(userId?: string) {
    try {
      const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      return await this.request(`/sessions${params}`);
    } catch (err) {
      console.error('getSessions failed', err);
      return [];
    }
  }

  async getSession(id: string) {
    try {
      return await this.request(`/sessions/${id}`);
    } catch (err) {
      console.error('getSession failed', err);
      return null;
    }
  }

  async getAllSessions() {
    try {
      return await this.request('/sessions/view/all');
    } catch (err) {
      console.error('getAllSessions failed', err);
      return [];
    }
  }
}

export const apiService = new ApiService();
