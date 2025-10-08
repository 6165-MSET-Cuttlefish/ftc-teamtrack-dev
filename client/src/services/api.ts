function getApiBase() {
  const g = globalThis as typeof globalThis & { __API_BASE?: string };
  if (g.__API_BASE) return g.__API_BASE;
  const envUrl = import.meta.env.VITE_API_URL || '';
  let val = envUrl || '/api';
  try {
    if (typeof window !== 'undefined' && envUrl) {
      const envIsLocalhost =
        envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
      const runningOnLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      if (envIsLocalhost && !runningOnLocalhost) {
        val = '/api';
      }
    }
  } catch {
    // ignore
  }
  g.__API_BASE = val;
  return val;
}

class ApiService {
  private cache = new Map<
    string,
    { data: unknown; timestamp: number; ttl: number }
  >();
  private requestQueue = new Map<string, Promise<unknown>>();
  private rateLimiter = {
    requests: new Map<string, number[]>(),
    maxRequests: 10, // Max requests per window
    windowMs: 60000, // 1 minute window
  };

  private getCacheKey(endpoint: string, options?: Record<string, unknown>): string {
    return `${endpoint}_${JSON.stringify(options || {})}`;
  }

  private isRateLimited(endpoint: string): boolean {
    const now = Date.now();
    const requests = this.rateLimiter.requests.get(endpoint) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(
      time => now - time < this.rateLimiter.windowMs
    );
    this.rateLimiter.requests.set(endpoint, validRequests);

    return validRequests.length >= this.rateLimiter.maxRequests;
  }

  private recordRequest(endpoint: string): void {
    const now = Date.now();
    const requests = this.rateLimiter.requests.get(endpoint) || [];
    requests.push(now);
    this.rateLimiter.requests.set(endpoint, requests);
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T, ttl: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    cacheTtl?: number
  ): Promise<T> {
    const cacheKey = this.getCacheKey(endpoint, options?.body ? { body: options.body } : undefined);

    // Check cache first for GET requests
    if (!options?.method || options.method === 'GET') {
      const cachedData = this.getCachedData<T>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    // Check if already making this request (deduplication)
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey) as Promise<T>;
    }

    // Rate limiting check
    if (this.isRateLimited(endpoint)) {
      console.warn(
        `Rate limited for ${endpoint}. Please wait before making more requests.`
      );
      throw new Error(
        `Too many requests to ${endpoint}. Please wait a moment.`
      );
    }

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
        console.warn(
          `fetch failed for ${candidateUrl}:`,
          err instanceof Error ? err.message : err
        );
        return undefined;
      }
    };

    const requestPromise = (async (): Promise<T> => {
      try {
        // Record the request for rate limiting
        this.recordRequest(endpoint);

        // Primary attempt
        let response: Response | undefined = await tryFetch(url);

        // Prepare fallback candidates
        const fallbackCandidates: string[] = [];
        try {
          if (typeof window !== 'undefined') {
            const origin = window.location.origin;
            fallbackCandidates.push(`${origin}${endpoint}`);
            // Try common API mount point
            fallbackCandidates.push(`${origin}/api${endpoint}`);
            fallbackCandidates.push(
              `${origin}/.netlify/functions/api${endpoint}`
            );
          }

          const explicitEnv = import.meta.env.VITE_API_URL || '';
          // If an explicit env URL is provided, try it as a fallback as well
          if (explicitEnv) {
            // Ensure proper slash handling
            const trimmed = explicitEnv.replace(/\/$/, '');
            fallbackCandidates.push(`${trimmed}${endpoint}`);
            // Also try explicit env + /api prefix
            fallbackCandidates.push(`${trimmed}/api${endpoint}`);
          }
        } catch {
          // ignore
        }

        // Attempt fallbacks if initial response missing or not ok
        for (const candidate of fallbackCandidates) {
          if (!response || (response && !response.ok)) {
            const tryResp = await tryFetch(candidate);
            if (tryResp) response = tryResp;
          } else break;
        }

        const method = options?.method?.toString().toUpperCase() || 'GET';

        if (!response) {
          // All attempts failed
          if (method === 'GET' && endpoint.startsWith('/sessions'))
            return [] as unknown as T;
          throw new Error(
            `Network request failed for initial ${url} and fallbacks: ${fallbackCandidates.join(', ')}`
          );
        }

        if (!response.ok) {
          if (method === 'GET' && endpoint.startsWith('/sessions'))
            return [] as unknown as T;
          // Include which URL returned the error for easier debugging
          const attemptedUrl = response.url || url;
          throw new Error(
            `API call failed: ${response.status} ${response.statusText} at ${attemptedUrl}`
          );
        }

        let result: T;
        try {
          result = await response.json();
        } catch (err) {
          if (endpoint.startsWith('/sessions')) return [] as unknown as T;
          throw new Error(
            `Failed to parse JSON from ${url}: ${err instanceof Error ? err.message : String(err)}`
          );
        }

        // Cache successful GET requests
        if (method === 'GET' && result) {
          const ttl =
            cacheTtl || (endpoint.startsWith('/sessions') ? 30000 : 60000); // 30s for sessions, 1m for others
          this.setCachedData(cacheKey, result, ttl);
        }

        return result;
      } finally {
        // Remove from request queue
        this.requestQueue.delete(cacheKey);
      }
    })();

    // Store request in queue for deduplication
    this.requestQueue.set(cacheKey, requestPromise);

    return requestPromise;
  }

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
    try {
      const searchParams = new URLSearchParams();

      if (userId) {
        searchParams.append('userId', userId);
      }

      if (options) {
        if (options.limit)
          searchParams.append('limit', options.limit.toString());
        if (options.offset)
          searchParams.append('offset', options.offset.toString());
        if (options.sortBy) searchParams.append('sortBy', options.sortBy);
        if (options.sortOrder)
          searchParams.append('sortOrder', options.sortOrder);
        if (options.matchType)
          searchParams.append('matchType', options.matchType);
        if (options.dateFrom) searchParams.append('dateFrom', options.dateFrom);
        if (options.dateTo) searchParams.append('dateTo', options.dateTo);
      }

      const params = searchParams.toString();
      const endpoint = `/sessions${params ? `?${params}` : ''}`;

      // Use longer cache for sessions data since it doesn't change frequently
      return await this.request(endpoint, undefined, 45000); // 45 second cache
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

  async getUserSessionStats(userId: string) {
    try {
      // Use longer cache for stats since they change less frequently
      return await this.request(`/sessions/stats/${userId}`, undefined, 60000); // 1 minute cache
    } catch (err) {
      console.error('getUserSessionStats failed', err);
      return null;
    }
  }
}

export const apiService = new ApiService();
