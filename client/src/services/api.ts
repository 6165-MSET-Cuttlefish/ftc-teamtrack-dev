import { SafeApiClient, ApiResponse, withRetry } from '../lib/safeApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiService {
  private client: SafeApiClient;

  constructor() {
    this.client = new SafeApiClient(API_BASE_URL);
  }

  private async safeRequest<T>(
    operation: () => Promise<ApiResponse<T>>
  ): Promise<T> {
    const result = await withRetry(operation);
    
    if (!result.success) {
      throw result.error || new Error('API request failed');
    }
    
    return result.data!;
  }

  // Session API calls matching your backend endpoints
  async createSession(sessionData: Record<string, unknown>) {
    return this.safeRequest(() => this.client.post('/sessions', sessionData));
  }

  async getSessions(
    userId?: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'sessionName' | 'finalScore';
      sortOrder?: 'asc' | 'desc';
      matchType?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
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
    
    try {
      return await this.safeRequest(() => 
        this.client.get(`/sessions${queryString ? `?${queryString}` : ''}`)
      );
    } catch (error: unknown) {
      // Handle 503 Service Unavailable (database not configured) gracefully
      if (error && typeof error === 'object' && 'status' in error && error.status === 503) {
        return {
          sessions: [],
          pagination: {
            total: 0,
            offset: options?.offset || 0,
            limit: options?.limit || 20,
            hasMore: false,
          },
        };
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  async getSession(id: string) {
    return this.safeRequest(() => this.client.get(`/sessions/${id}`));
  }

  async getAllSessions() {
    return this.safeRequest(() => this.client.get('/sessions/view/all'));
  }

  async getUserSessionStats(userId: string) {
    try {
      return await this.safeRequest(() => this.client.get(`/sessions/stats/${userId}`));
    } catch (error: unknown) {
      // Handle 503 Service Unavailable (database not configured) gracefully
      if (error && typeof error === 'object' && 'status' in error && error.status === 503) {
        return {
          totalSessions: 0,
          averageScore: 0,
          highestScore: 0,
          totalPlayTime: 0,
          matchTypeBreakdown: {},
          recentSessions: [],
          performanceTrend: [],
        };
      }
      
      // Re-throw other errors
      throw error;
    }
  }
}

export const apiService = new ApiService();
