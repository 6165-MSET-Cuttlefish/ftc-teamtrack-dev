function getApiBase() {
  const g = globalThis as any;
  if (g.__API_BASE) return g.__API_BASE;
  const envUrl = import.meta.env.VITE_API_URL || '';
  let val = envUrl || '/api';
  try {
    if (typeof window !== 'undefined' && envUrl) {
      const envIsLocalhost = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
      const runningOnLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (envIsLocalhost && !runningOnLocalhost) {
        val = '/api';
      }
    }
  } catch (e) {
    // ignore
  }
  g.__API_BASE = val;
  return val;
}

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${getApiBase()}${endpoint}`;

    const fetchOptions: RequestInit = {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    };

    // Helper to try fetch and return undefined on failure
    const tryFetch = async (candidateUrl: string) => {
      try {
        const res = await fetch(candidateUrl, fetchOptions);
        return res;
      } catch (err) {
        // swallow here and return undefined so callers can attempt fallbacks
        console.warn(`fetch failed for ${candidateUrl}:`, err instanceof Error ? err.message : err);
        return undefined;
      }
    };

    // Primary attempt
    let response: Response | undefined = await tryFetch(url);

    // Fallbacks (helpful in various hosting setups like Netlify functions)
    if (!response) {
      try {
        if (typeof window !== 'undefined') {
          const origin = window.location.origin;
          // Try origin + endpoint (same origin)
          response = await tryFetch(`${origin}${endpoint}`);
          // Try Netlify functions convention
          if (!response) response = await tryFetch(`${origin}/.netlify/functions/api${endpoint}`);
        }
      } catch (e) {
        // ignore
      }
    }

    const method = options?.method?.toString().toUpperCase() || 'GET';

    if (!response) {
      // All attempts failed
      if (method === 'GET' && endpoint.startsWith('/sessions')) return [] as unknown as T;
      throw new Error(`Network request failed for ${url} (and fallbacks)`);
    }

    if (!response.ok) {
      if (method === 'GET' && endpoint.startsWith('/sessions')) return [] as unknown as T;
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch (err) {
      if (endpoint.startsWith('/sessions')) return [] as unknown as T;
      throw new Error(`Failed to parse JSON from ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async createSession(sessionData: Record<string, unknown>) {
    try {
      return await this.request('/sessions', { method: 'POST', body: JSON.stringify(sessionData) });
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
