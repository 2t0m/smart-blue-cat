const NodeCache = require('node-cache');
const logger = require('./logger');

// Prevent multiple initialization logs
let cacheInitialized = false;

class CacheManager {
  constructor() {
    // Cache for different data types with appropriate TTLs
    this.tmdbCache = new NodeCache({ stdTTL: 2592000 }); // 30 days for TMDB (metadata rarely changes)
    this.searchCache = new NodeCache({ stdTTL: 21600 }); // 6 hours for searches (increased from 2h)
    this.alldebridCache = new NodeCache({ stdTTL: 300 }); // 5 min for AllDebrid status
    this.magnetCache = new NodeCache({ stdTTL: 172800 }); // 48h for processed magnets (doubled)
    this.hashCache = new NodeCache({ stdTTL: 43200 }); // 12h for torrent hashes (6x longer)
    this.readyHashCache = new NodeCache({ stdTTL: 604800 }); // 7 days for ready hashes (once ready, likely to stay)
    this.filesCache = new NodeCache({ stdTTL: 21600 }); // 6 hours for AllDebrid files list (3x longer)
    this.linkCache = new NodeCache({ stdTTL: 3600 }); // 1 hour for unlocked download links (2x longer)
    this.seasonCache = new NodeCache({ stdTTL: 21600 }); // 6 hours for complete season data
    
    if (!cacheInitialized) {
      logger.info('🚀 Cache manager initialized with optimized TTL settings');
      cacheInitialized = true;
    }
  }

  // Cache TMDB responses (metadata)
  getTmdb(key) {
    const result = this.tmdbCache.get(key);
    if (result) {
      logger.debug(`💾 TMDB cache HIT for: ${key}`);
      return result;
    }
    logger.debug(`🔍 TMDB cache MISS for: ${key}`);
    return null;
  }

  setTmdb(key, value) {
    this.tmdbCache.set(key, value);
    logger.debug(`💾 TMDB cached: ${key}`);
  }

  // Cache search results (YGG/Sharewood)
  getSearch(key) {
    const result = this.searchCache.get(key);
    if (result) {
      logger.debug(`💾 Search cache HIT for: ${key}`);
      return result;
    }
    logger.debug(`🔍 Search cache MISS for: ${key}`);
    return null;
  }

  setSearch(key, value) {
    this.searchCache.set(key, value);
    logger.debug(`💾 Search cached: ${key}`);
  }

  // Cache AllDebrid status
  getAllDebrid(key) {
    const result = this.alldebridCache.get(key);
    if (result) {
      logger.debug(`💾 AllDebrid cache HIT for: ${key}`);
      return result;
    }
    logger.debug(`🔍 AllDebrid cache MISS for: ${key}`);
    return null;
  }

  setAllDebrid(key, value) {
    this.alldebridCache.set(key, value);
    logger.debug(`💾 AllDebrid cached: ${key}`);
  }

  // Cache processed magnets to avoid reprocessing
  getMagnet(hash) {
    const result = this.magnetCache.get(hash);
    if (result) {
      logger.debug(`💾 Magnet cache HIT for: ${hash}`);
      return result;
    }
    logger.debug(`🔍 Magnet cache MISS for: ${hash}`);
    return null;
  }

  setMagnet(hash, value) {
    this.magnetCache.set(hash, value);
    logger.debug(`💾 Magnet cached: ${hash}`);
  }

  // Cache for ready hashes (already available on AllDebrid)
  getReadyHash(hash) {
    const result = this.readyHashCache.get(`ready:${hash}`);
    if (result !== undefined) {  // Fix: check for undefined instead of falsy
      logger.debug(`🎯 Ready hash cache HIT for: ${hash} (ready: ${result})`);
      return result;
    }
    logger.debug(`🔍 Ready hash cache MISS for: ${hash}`);
    return null;
  }

  storeReadyHash(hash, isReady = true) {
    this.readyHashCache.set(`ready:${hash}`, isReady);
    logger.debug(`💾 Ready hash cached: ${hash} (ready: ${isReady})`);
  }

  // Cache for AllDebrid files list
  getFiles(magnetId) {
    const result = this.filesCache.get(`files:${magnetId}`);
    if (result) {
      logger.debug(`💾 Files cache HIT for magnet: ${magnetId}`);
      return result;
    }
    logger.debug(`🔍 Files cache MISS for magnet: ${magnetId}`);
    return null;
  }

  setFiles(magnetId, files) {
    this.filesCache.set(`files:${magnetId}`, files);
    logger.debug(`💾 Files cached for magnet: ${magnetId} (${files.length} files)`);
  }

  // Cache for unlocked download links
  getLink(linkUrl) {
    const result = this.linkCache.get(`link:${linkUrl}`);
    if (result) {
      logger.debug(`💾 Link cache HIT for: ${linkUrl.slice(-20)}...`);
      return result;
    }
    logger.debug(`🔍 Link cache MISS for: ${linkUrl.slice(-20)}...`);
    return null;
  }

  setLink(linkUrl, unlockedData) {
    this.linkCache.set(`link:${linkUrl}`, unlockedData);
    logger.debug(`💾 Link cached: ${linkUrl.slice(-20)}...`);
  }

  // Helper to generate cache keys
  generateKey(type, params) {
    if (Array.isArray(params)) {
      return `${type}:${params.join(':')}`;
    }
    if (typeof params === 'object') {
      return `${type}:${JSON.stringify(params)}`;
    }
    return `${type}:${params}`;
  }

  // Get cache statistics
  getStats() {
    return {
      tmdb: this.tmdbCache.getStats(),
      search: this.searchCache.getStats(),
      alldebrid: this.alldebridCache.getStats(),
      magnet: this.magnetCache.getStats(),
      readyHash: this.readyHashCache.getStats(),
      files: this.filesCache.getStats(),
      link: this.linkCache.getStats(),
      season: this.seasonCache.getStats()
    };
  }

  // Season cache methods for intelligent prefetching
  getSeason(key) {
    const result = this.seasonCache.get(key);
    if (result) {
      logger.debug(`💾 Season cache HIT for: ${key}`);
      return result;
    }
    logger.debug(`🔍 Season cache MISS for: ${key}`);
    return null;
  }

  setSeason(key, value) {
    this.seasonCache.set(key, value);
    logger.debug(`💾 Season cached: ${key}`);
  }

  // Cache for torrent hashes (to avoid redundant hash lookups)
  getHash(key) {
    return this.hashCache.get(key);
  }

  storeHash(key, hash) {
    this.hashCache.set(key, hash);
    logger.debug(`💾 Hash cached: ${key}`);
  }

  // Clear specific cache
  clearCache(type) {
    switch (type) {
      case 'tmdb':
        this.tmdbCache.flushAll();
        break;
      case 'search':
        this.searchCache.flushAll();
        break;
      case 'alldebrid':
        this.alldebridCache.flushAll();
        break;
      case 'magnet':
        this.magnetCache.flushAll();
        break;
      case 'hash':
        this.hashCache.flushAll();
        break;
      case 'readyhash':
        this.readyHashCache.flushAll();
        break;
      case 'files':
        this.filesCache.flushAll();
        break;
      case 'link':
        this.linkCache.flushAll();
        break;
      case 'season':
        this.seasonCache.flushAll();
        break;
      case 'all':
        this.tmdbCache.flushAll();
        this.searchCache.flushAll();
        this.alldebridCache.flushAll();
        this.magnetCache.flushAll();
        this.hashCache.flushAll();
        this.readyHashCache.flushAll();
        this.filesCache.flushAll();
        this.linkCache.flushAll();
        break;
    }
    logger.info(`🗑️ Cleared ${type} cache`);
  }
}

// Export singleton instance
module.exports = new CacheManager();