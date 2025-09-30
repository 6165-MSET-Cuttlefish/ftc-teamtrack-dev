const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

  async getSessions(userId?: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'sessionName' | 'finalScore';
    sortOrder?: 'asc' | 'desc';
    matchType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const params = new URLSearchParams();
    
    if (userId) {
      params.append('userId', userId);
    }
    
    if (options) {
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.sortBy) params.append('sortBy', options.sortBy);
      if (options.sortOrder) params.append('sortOrder', options.sortOrder);
      if (options.matchType) params.append('matchType', options.matchType);
      if (options.dateFrom) params.append('dateFrom', options.dateFrom);
      if (options.dateTo) params.append('dateTo', options.dateTo);
    }
    
    const queryString = params.toString();
    return this.request(`/sessions${queryString ? `?${queryString}` : ''}`);
  }

  async getSession(id: string) {
    return this.request(`/sessions/${id}`);
  }

  async getAllSessions() {
    return this.request('/sessions/view/all');
  }

  async getUserSessionStats(userId: string) {
    return this.request(`/sessions/stats/${userId}`);
  }
}

export const apiService = new ApiService();
