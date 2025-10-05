/**
 * Database Usage Monitor
 * Tracks API calls to prevent excessive Firestore reads
 */

interface ApiCallLog {
  timestamp: number;
  endpoint: string;
  userId?: string;
  cached: boolean;
}

class DatabaseMonitor {
  private calls: ApiCallLog[] = [];
  private readonly MAX_CALLS_PER_HOUR = 1000; // Conservative limit
  private readonly WARNING_THRESHOLD = 800; // Warn at 80%
  private readonly HOUR_MS = 60 * 60 * 1000;

  logApiCall(endpoint: string, userId?: string, cached = false) {
    this.calls.push({
      timestamp: Date.now(),
      endpoint,
      userId,
      cached,
    });

    // Clean up old calls
    this.cleanup();
    
    // Check thresholds
    this.checkThresholds();
  }

  private cleanup() {
    const hourAgo = Date.now() - this.HOUR_MS;
    this.calls = this.calls.filter(call => call.timestamp > hourAgo);
  }

  private checkThresholds() {
    const uncachedCalls = this.calls.filter(call => !call.cached);
    
    if (uncachedCalls.length >= this.MAX_CALLS_PER_HOUR) {
      console.error(`🚨 DATABASE QUOTA EXCEEDED: ${uncachedCalls.length} calls in the last hour`);
      this.showQuotaWarning();
    } else if (uncachedCalls.length >= this.WARNING_THRESHOLD) {
      console.warn(`⚠️ Database usage warning: ${uncachedCalls.length}/${this.MAX_CALLS_PER_HOUR} calls used`);
    }
  }

  private showQuotaWarning() {
    if (typeof window !== 'undefined') {
      const message = `Database usage limit approached. Please refresh the page in a few minutes to avoid service interruption.`;
      
      // Try to show a user-friendly notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TeamTrack Database Warning', { body: message });
      } else {
        // Fallback to alert
        setTimeout(() => alert(message), 1000);
      }
    }
  }

  getUsageStats() {
    const hourAgo = Date.now() - this.HOUR_MS;
    const recentCalls = this.calls.filter(call => call.timestamp > hourAgo);
    const uncachedCalls = recentCalls.filter(call => !call.cached);
    
    return {
      totalCalls: recentCalls.length,
      uncachedCalls: uncachedCalls.length,
      cachedCalls: recentCalls.length - uncachedCalls.length,
      cacheHitRate: recentCalls.length > 0 ? 
        ((recentCalls.length - uncachedCalls.length) / recentCalls.length * 100).toFixed(1) : '0',
      quotaUsed: ((uncachedCalls.length / this.MAX_CALLS_PER_HOUR) * 100).toFixed(1),
    };
  }

  // Method to manually check if we should throttle requests
  shouldThrottleRequests(): boolean {
    const uncachedCalls = this.calls.filter(call => !call.cached);
    return uncachedCalls.length >= this.MAX_CALLS_PER_HOUR * 0.95; // At 95% capacity
  }
}

export const dbMonitor = new DatabaseMonitor();

// Export stats for debugging
if (typeof window !== 'undefined') {
  (window as any).dbMonitor = dbMonitor;
}