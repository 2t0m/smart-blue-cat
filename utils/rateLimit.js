const logger = require('./logger');

class RateLimiter {
  constructor(maxRequests = 12, windowMs = 1000, maxQueueSize = 100) {
    this.maxRequests = maxRequests; // 12 requests per second (AllDebrid limit)
    this.windowMs = windowMs; // 1 second window
    this.maxQueueSize = maxQueueSize; // Maximum queued requests
    
    this.requests = []; // Track request timestamps
    this.queue = []; // Queue for pending requests
    this.processing = false;
    
    logger.info(`[rateLimit] 🚦 Rate limiter initialized: ${maxRequests} req/sec, queue size: ${maxQueueSize}`);
  }

  // Check if we can make a request now
  canMakeRequest() {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    logger.debug(`[rateLimit] canMakeRequest: ${this.requests.length} requests in window (max: ${this.maxRequests})`);
    return this.requests.length < this.maxRequests;
  }

  // Add a request to tracking
  recordRequest() {
    this.requests.push(Date.now());
    logger.debug(`[rateLimit] recordRequest: request recorded at ${this.requests[this.requests.length - 1]}`);
  }

  // Calculate delay until next available slot
  getDelay() {
    if (this.canMakeRequest()) return 0;
    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    const delay = Math.max(0, this.windowMs - (now - oldestRequest) + 10); // +10ms buffer
    logger.debug(`[rateLimit] getDelay: ${delay}ms until next slot`);
    return delay;
  }

  // Execute a function with rate limiting
  async execute(fn, context = 'request') {
    logger.debug(`[rateLimit] IN: execute (${context})`);
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.maxQueueSize) {
        logger.error(`[rateLimit] Queue full for context: ${context} (${this.maxQueueSize})`);
        reject(new Error(`Rate limiter queue full (${this.maxQueueSize})`));
        return;
      }
      this.queue.push({ fn, resolve, reject, context, timestamp: Date.now() });
      logger.debug(`[rateLimit] Queued ${context} (queue size: ${this.queue.length})`);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    logger.debug('[rateLimit] IN: processQueue');
    this.processing = true;
    while (this.queue.length > 0) {
      const { fn, resolve, reject, context } = this.queue.shift();
      
      try {
        if (this.canMakeRequest()) {
          this.recordRequest();
          logger.debug(`[rateLimit] Executing ${context} (${this.requests.length}/${this.maxRequests} in window)`);
          
          const result = await fn();
          resolve(result);
        } else {
          const delay = this.getDelay();
          logger.debug(`[rateLimit] Rate limit reached, waiting ${delay}ms for ${context}`);
          
          // Put the request back at the front of the queue
          this.queue.unshift({ fn, resolve, reject, context });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.error(`[rateLimit] Rate limiter error for ${context}:`, error.message);
        reject(error);
      }
    }
    
    this.processing = false;
    logger.debug('[rateLimit] OUT: processQueue');
  }

  // Get current status
  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    const status = {
      requestsInWindow: this.requests.length,
      maxRequests: this.maxRequests,
      queueSize: this.queue.length,
      canMakeRequest: this.canMakeRequest(),
      nextAvailableIn: this.getDelay()
    };
    // logger.debug(`[rateLimit] getStatus: ${JSON.stringify(status)}`); // Suppressed: too verbose
    return status;
  }
}

// Circuit breaker for handling cascading failures
class CircuitBreaker {
  constructor(threshold = 5, timeout = 30000, monitorTimeout = 60000) {
    this.threshold = threshold; // Number of failures before opening
    this.timeout = timeout; // Time to stay open (30s)
    this.monitorTimeout = monitorTimeout; // Time to reset counters (60s)
    
    this.failures = 0;
    this.lastFailure = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    
    logger.info(`[rateLimit] ⚡ Circuit breaker initialized: threshold=${threshold}, timeout=${timeout}ms`);
  }

  async execute(fn, context = 'operation') {
    logger.debug(`[rateLimit] IN: circuitBreaker.execute (${context})`);
    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.lastFailure;
      if (timeSinceLastFailure < this.timeout) {
        logger.warn(`[rateLimit] Circuit breaker OPEN for ${context} (${Math.ceil((this.timeout - timeSinceLastFailure) / 1000)}s remaining)`);
        throw new Error(`Circuit breaker OPEN for ${context} (${Math.ceil((this.timeout - timeSinceLastFailure) / 1000)}s remaining)`);
      } else {
        this.state = 'HALF_OPEN';
        logger.info(`[rateLimit] Circuit breaker HALF_OPEN for ${context}`);
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        logger.info(`[rateLimit] Circuit breaker CLOSED for ${context} (recovery successful)`);
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        logger.error(`[rateLimit] Circuit breaker OPEN for ${context} (${this.failures} failures)`);
      }
      logger.error(`[rateLimit] Circuit breaker error for ${context}: ${error.message}`);
      throw error;
    }
  }

  getStatus() {
    const status = {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
      lastFailure: this.lastFailure,
      canExecute: this.state !== 'OPEN' || (Date.now() - this.lastFailure) >= this.timeout
    };
    // logger.debug(`[rateLimit] circuitBreaker.getStatus: ${JSON.stringify(status)}`); // Suppressed: too verbose
    return status;
  }
}

// Create singleton instances for AllDebrid
const allDebridRateLimiter = new RateLimiter(12, 1000); // 12 req/sec
const allDebridCircuitBreaker = new CircuitBreaker(5, 30000); // 5 failures, 30s timeout

module.exports = {
  RateLimiter,
  CircuitBreaker,
  allDebridRateLimiter,
  allDebridCircuitBreaker
};