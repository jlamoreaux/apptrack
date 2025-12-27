// Simple in-memory cache for roast results
// In production, consider using Redis or similar

interface CachedRoast {
  data: any;
  timestamp: number;
  expiresAt: number;
}

class RoastCache {
  private cache = new Map<string, CachedRoast>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly MAX_SIZE = 100; // Max number of cached items
  
  get(key: string): any | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  set(key: string, data: any): void {
    // Implement LRU-style cleanup if cache is too large
    if (this.cache.size >= this.MAX_SIZE) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.TTL
    });
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
let cacheInstance: RoastCache | null = null;

export function getRoastCache(): RoastCache {
  if (!cacheInstance) {
    cacheInstance = new RoastCache();
    
    // Run cleanup every minute
    if (typeof window === "undefined") {
      // Server-side: use setInterval
      setInterval(() => {
        cacheInstance?.cleanup();
      }, 60 * 1000);
    }
  }
  
  return cacheInstance;
}