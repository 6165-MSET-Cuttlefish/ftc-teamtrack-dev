const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return response.json();
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
