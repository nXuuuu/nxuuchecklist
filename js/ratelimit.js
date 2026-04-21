/**
 * Rate Limiter
 * Prevents API spam, brute force attacks, and accidental DoS
 */

'use strict';

class RateLimiter {
  constructor(maxRequests = 20, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  /**
   * Check if request is allowed
   */
  isAllowed() {
    const now = Date.now();
    
    // Remove requests outside the time window
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    
    // Check if we've exceeded the limit
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    // Record this request
    this.requests.push(now);
    return true;
  }
  
  /**
   * Execute function only if rate limit allows
   */
  async execute(fn, errorCallback) {
    if (!this.isAllowed()) {
      const waitTime = Math.ceil(this.windowMs / 1000);
      const errorMsg = `Too many requests. Please wait ${waitTime} second${waitTime > 1 ? 's' : ''} before trying again.`;
      
      if (errorCallback) {
        errorCallback(errorMsg);
      }
      throw new Error(errorMsg);
    }
    
    return fn();
  }
  
  /**
   * Get remaining requests in current window
   */
  getRemaining() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }
  
  /**
   * Reset limiter
   */
  reset() {
    this.requests = [];
  }
}

// Create rate limiters for different operations
const tradeApiLimiter = new RateLimiter(30, 1000);      // 30 requests per second for trades
const authLimiter = new RateLimiter(5, 60000);          // 5 requests per minute for auth
const generalApiLimiter = new RateLimiter(20, 1000);    // 20 requests per second for other APIs
