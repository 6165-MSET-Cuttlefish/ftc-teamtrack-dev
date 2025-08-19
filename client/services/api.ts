import { DemoResponse } from '@shared/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'; // Replace with your backend URL

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

  // Example API calls
  async ping(): Promise<{ message: string }> {
    return this.request('/api/ping');
  }

  async getDemo(): Promise<DemoResponse> {
    return this.request('/api/demo');
  }

  // Session-related API calls (examples for your TeamTrack app)
  async saveSession(sessionData: any) {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getSessions() {
    return this.request('/api/sessions');
  }

  async getSession(id: string) {
    return this.request(`/api/sessions/${id}`);
  }
}

export const apiService = new ApiService();
