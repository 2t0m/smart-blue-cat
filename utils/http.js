const axios = require('axios');
const logger = require('./logger');

class HttpClient {
  constructor() {
    this.defaultTimeout = 10000; // 10s
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1s

  }

  /**
   * Perform HTTP request with timeout, retry logic and exponential backoff
   * @param {Object} options - Axios configuration options
   * @param {number} options.timeout - Timeout in ms (default: 10000)
   * @param {number} options.maxRetries - Max retry attempts (default: 3) 
   * @param {boolean} options.useCircuitBreaker - Use circuit breaker if available
   * @param {string} options.source - Source name for logging (YGG, SW, TMDB, etc.)
   * @returns {Promise} - Axios response
   */
  async request(options) {
    const {
      timeout = this.defaultTimeout,
      maxRetries = this.maxRetries,
      useCircuitBreaker = false,
      source = 'HTTP',
      ...axiosConfig
    } = options;

    // Configure axios with timeout and other settings
    const config = {
      ...axiosConfig,
      timeout,
      headers: {
        'User-Agent': 'SmartBlueCat/1.0 (compatible)',
        ...axiosConfig.headers
      }
    };

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const isRetry = attempt > 1;
        if (isRetry) {
          const delay = this.calculateDelay(attempt - 1);
          logger.debug(`🔄 [${source}] Retry attempt ${attempt - 1}/${maxRetries} after ${delay}ms delay`);
          await this.sleep(delay);
        }

        logger.debug(`🌐 [${source}] HTTP ${config.method?.toUpperCase() || 'GET'} ${config.url} (attempt ${attempt}/${maxRetries + 1})`);
        
        const startTime = Date.now();
        const response = await axios(config);
        const duration = Date.now() - startTime;
        
        logger.debug(`✅ [${source}] HTTP ${response.status} in ${duration}ms`);
        
        // Reset circuit breaker on success if available
        if (useCircuitBreaker && global.circuitBreaker) {
          global.circuitBreaker.recordSuccess();
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        const duration = Date.now();
        
        // Log error details
        if (error.code === 'ENOTFOUND') {
          logger.warn(`🌐 [${source}] DNS resolution failed: ${error.message}`);
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          logger.warn(`⏱️ [${source}] Timeout after ${timeout}ms`);
        } else if (error.response) {
          logger.warn(`❌ [${source}] HTTP ${error.response.status}: ${error.response.statusText}`);
        } else {
          logger.warn(`💥 [${source}] Request failed: ${error.message}`);
        }

        // Record failure in circuit breaker if available
        if (useCircuitBreaker && global.circuitBreaker) {
          global.circuitBreaker.recordFailure();
        }

        // Don't retry on certain status codes
        if (error.response && this.isNonRetryableStatus(error.response.status)) {
          logger.debug(`⚠️ [${source}] Non-retryable status ${error.response.status}, stopping retries`);
          break;
        }

        // Don't retry if max attempts reached
        if (attempt > maxRetries) {
          logger.error(`💀 [${source}] Max retries (${maxRetries}) exceeded`);
          break;
        }
      }
    }


    throw lastError;
  }

  /**
   * Calculate exponential backoff delay with jitter
   * @param {number} attempt - Retry attempt number (0-based)
   * @returns {number} - Delay in milliseconds
   */
  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * 2^attempt + jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1s jitter
    const maxDelay = 15000; // Cap at 15s
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Check if HTTP status code should not be retried
   * @param {number} status - HTTP status code
   * @returns {boolean} - True if should not retry
   */
  isNonRetryableStatus(status) {
    // Don't retry client errors (except 408, 429)
    return status >= 400 && status < 500 && status !== 408 && status !== 429;
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Duration in milliseconds
   * @returns {Promise} - Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET request with retry logic
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise} - Response data
   */
  async get(url, options = {}) {
    const response = await this.request({
      method: 'get',
      url,
      ...options
    });
    return response;
  }

  /**
   * POST request with retry logic
   * @param {string} url - Request URL
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise} - Response data
   */
  async post(url, data, options = {}) {
    const response = await this.request({
      method: 'post',
      url,
      data,
      ...options
    });
    return response;
  }
}

// Create singleton instance
const httpClient = new HttpClient();

module.exports = httpClient;