import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { dbMonitor } from '../lib/dbMonitor';
import { Database, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const DatabaseUsageMonitor: React.FC = () => {
  const [stats, setStats] = useState(dbMonitor.getUsageStats());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const newStats = dbMonitor.getUsageStats();
      setStats(newStats);
      
      // Auto-show if usage is high
      if (parseFloat(newStats.quotaUsed) > 70) {
        setIsVisible(true);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (quotaUsed: string) => {
    const usage = parseFloat(quotaUsed);
    if (usage >= 95) return 'destructive';
    if (usage >= 80) return 'secondary';
    return 'default';
  };

  const getStatusIcon = (quotaUsed: string) => {
    const usage = parseFloat(quotaUsed);
    if (usage >= 95) return <AlertTriangle className="h-4 w-4" />;
    if (usage >= 80) return <Clock className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={() => setIsVisible(true)}
        title="Show database usage monitor"
      >
        <Database className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Usage Monitor
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
          >
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Quota Used:</span>
          <Badge 
            variant={getStatusColor(stats.quotaUsed)}
            className="flex items-center gap-1"
          >
            {getStatusIcon(stats.quotaUsed)}
            {stats.quotaUsed}%
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm">Cache Hit Rate:</span>
          <Badge variant="outline">{stats.cacheHitRate}%</Badge>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Total Calls:</span>
            <span>{stats.totalCalls}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Cached:</span>
            <span className="text-green-600">{stats.cachedCalls}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Database Reads:</span>
            <span className="text-orange-600">{stats.uncachedCalls}</span>
          </div>
        </div>

        {parseFloat(stats.quotaUsed) > 80 && (
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            ⚠️ High database usage detected. Consider refreshing the page in a few minutes.
          </div>
        )}

        {parseFloat(stats.quotaUsed) > 95 && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            🚨 Database quota nearly exceeded. New requests may be throttled.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseUsageMonitor;