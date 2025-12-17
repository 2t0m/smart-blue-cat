const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { allDebridRateLimiter, allDebridCircuitBreaker } = require('../utils/rateLimit');

let cleanupTimeout = null;

// Schedule cleanup of old magnets
function scheduleCleanup(config, delayMs = 1 * 60 * 1000) {
  if (cleanupTimeout) clearTimeout(cleanupTimeout);
  cleanupTimeout = setTimeout(() => {
    cleanupOldMagnets(config);
  }, delayMs);
}

// Rate-limited wrapper for AllDebrid API calls
async function makeAllDebridRequest(requestFn, context = 'API call') {
  return allDebridRateLimiter.execute(async () => {
    return allDebridCircuitBreaker.execute(requestFn, context);
  }, context);
}

// Check instant availability of magnets via AllDebrid API  
async function checkInstantAvailability(hashes, config) {
  // Check our ready hash cache first (very fast) - this takes priority over AllDebrid cache
  const results = {};
  const uncachedHashes = [];
  let readyHashHits = 0;
  
  hashes.forEach(hash => {
    const readyCache = cache.getReadyHash(hash);
    if (readyCache !== null) {
      results[hash] = {
        instant: readyCache,
        cached: true
      };
      readyHashHits++;
      logger.debug(`[alldebrid] 🎯 Ready hash found in cache: ${hash} (ready: ${readyCache})`);
    } else {
      uncachedHashes.push(hash);
    }
  });

  // If all hashes were found in ready cache, return immediately
  if (uncachedHashes.length === 0) {
    const instantCount = Object.values(results).filter(r => r.instant).length;
    logger.info(`[alldebrid] 🎯 Ready hash cache: ${instantCount}/${hashes.length} magnets instantly ready (${readyHashHits} cache hits)`);
    return results;
  }

  // Check AllDebrid cache for remaining uncached hashes only
  const cacheKey = cache.generateKey('instant', uncachedHashes.sort());
  const cached = cache.getAllDebrid(cacheKey);
  
  if (cached) {
    // Merge cached results with ready hash results
    Object.assign(results, cached);
    logger.debug(`[alldebrid] ⚡ AllDebrid cache hit for ${uncachedHashes.length} remaining hashes`);
  } else {
    // No cache hit - mark remaining hashes as not instantly available
    uncachedHashes.forEach(hash => {
      // Check magnet cache as fallback
      const cachedMagnet = cache.getMagnet(hash);
      if (cachedMagnet) {
        const isReady = cachedMagnet.status === 'ready';
        results[hash] = {
          instant: isReady,
          cached: true
        };
        // Store in ready cache for next time
        cache.storeReadyHash(hash, isReady);
      } else {
        results[hash] = {
          instant: false,
          cached: false
        };
      }
    });
    
    // Cache the results for uncached hashes only
    const uncachedResults = {};
    uncachedHashes.forEach(hash => {
      uncachedResults[hash] = results[hash];
    });
    cache.setAllDebrid(cacheKey, uncachedResults);
  }
  
  const instantCount = Object.values(results).filter(r => r.instant).length;
  logger.info(`[alldebrid] 🎯 Instant availability check: ${instantCount}/${hashes.length} magnets instantly ready (${readyHashHits} from ready cache)`);
  
  return results;
}

// Upload magnets to AllDebrid with optimization
async function uploadMagnets(magnets, config) {
  // Perform cleanup before first upload
  await cleanupOldMagnets(config);
  
  // Step 1: Check instant availability
  const hashes = magnets.map(m => m.hash);
  const availability = await checkInstantAvailability(hashes, config);
  
  // Step 2: Filter magnets based on availability and cache
  const { readyMagnets, needUpload } = magnets.reduce((acc, magnet) => {
    const avail = availability[magnet.hash];
    if (avail && avail.instant) {
      // Add to ready magnets with cached info
      const cachedMagnet = cache.getMagnet(magnet.hash);
      if (cachedMagnet) {
        acc.readyMagnets.push({
          hash: magnet.hash,
          ready: '✅ Ready',
          name: cachedMagnet.name || magnet.title,
          size: cachedMagnet.size || 0,
          id: cachedMagnet.id,
          source: magnet.source
        });
      }
    } else {
      acc.needUpload.push(magnet);
    }
    return acc;
  }, { readyMagnets: [], needUpload: [] });

  logger.info(`[alldebrid] 🎯 Upload optimization: ${readyMagnets.length} instant ready, ${needUpload.length} need upload`);

  if (needUpload.length === 0) {
    logger.info('[alldebrid] ⚡ All magnets instantly available from cache!');
    return readyMagnets;
  }

  // Step 3: Upload only the magnets that need it
  const url = `https://api.alldebrid.com/v4/magnet/upload`;
  
  // Extract hashes from the magnets that need upload
  const uploadHashes = needUpload.map(m => m.hash);
  const formData = new FormData();
  uploadHashes.forEach(hash => formData.append("magnets[]", hash));

  try {
    logger.info("[alldebrid] 🔄 Uploading magnets...");
    const response = await makeAllDebridRequest(async () => {
      return axios.post(url, formData, {
        headers: {
          "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
          ...formData.getHeaders()
        },
        timeout: 15000
      });
    }, 'magnet-upload');

    if (response.data.status === "success") {
      logger.info(`[alldebrid] ✅ Successfully uploaded ${response.data.data.magnets.length} magnets.`);
      // logger.debug(JSON.stringify(response.data, null, 2)); // Suppressed: too verbose
      
      try {
        logger.debug(`[alldebrid] 🔧 DEBUG: Starting cleanup and storage...`);
        scheduleCleanup(config);
        
        logger.debug(`[alldebrid] 🔧 DEBUG: Processing magnets...`);
        for (const magnet of response.data.data.magnets) {
          logger.debug(`[alldebrid] 🔧 DEBUG: Processing magnet - ID: ${magnet.id}, Hash: ${magnet.hash || 'MISSING'}, Name: ${magnet.name || 'MISSING'}`);
          if (magnet.id && magnet.hash && magnet.name) {
            // Cache processed magnet to avoid reprocessing
            cache.setMagnet(magnet.hash, { 
              status: 'processed', 
              id: magnet.id, 
              ready: magnet.ready 
            });
            
            // Cache ready status for future instant availability checks
            cache.storeReadyHash(magnet.hash, magnet.ready);
            
            logger.debug(`[alldebrid] ✅ Stored magnet: ${magnet.id}`);
          } else {
            logger.warn(`[alldebrid] ⚠️ Skipping invalid magnet - ID: ${magnet.id}, Hash: ${magnet.hash}, Name: ${magnet.name}`);
          }
        }
        
        logger.debug(`[alldebrid] 🔧 DEBUG: Mapping magnet results...`);
        const result = response.data.data.magnets.map(magnet => ({
          hash: magnet.hash,
          ready: magnet.ready ? '✅ Ready' : '❌ Not ready',
          name: magnet.name,
          size: magnet.size,
          id: magnet.id,
          source: needUpload.find(m => m.hash === magnet.hash)?.source || "Unknown"
        }));
        
        logger.debug(`[alldebrid] 🔧 DEBUG: Successfully processed ${result.length} magnets`);
        
        // Combine ready magnets with newly uploaded ones
        const allResults = [...readyMagnets, ...result];
        logger.info(`[alldebrid] 🎯 Upload complete: ${readyMagnets.length} instant + ${result.length} uploaded = ${allResults.length} total`);
        
        return allResults;
      } catch (debugError) {
        logger.error(`[alldebrid] ❌ DEBUG: Error in success block: ${debugError.message}`);
        logger.error(`[alldebrid] ❌ DEBUG: Stack trace: ${debugError.stack}`);
        throw debugError;
      }
    } else {
      // Log status, error code and message if present
      const { status, error } = response.data;
      if (error && error.code && error.message) {
        logger.error(`[alldebrid] ❌ Error uploading magnets: status=${status}, code=${error.code}, message=${error.message}`);
      } else {
        logger.warn(`[alldebrid] ❌ Error uploading magnets: [response data suppressed]`);
      }
      scheduleCleanup(config);
      
      // Return ready magnets even if upload failed
      logger.info(`[alldebrid] ⚠️ Upload failed but returning ${readyMagnets.length} instant ready magnets`);
      return readyMagnets;
    }
  } catch (error) {
    logger.error("[alldebrid] ❌ Upload error:", error.response?.data || error.message);
    // logger.debug("AllDebrid upload error full response:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2)); // Suppressed: too verbose
    scheduleCleanup(config);
    
    // Return ready magnets even if upload failed
    logger.info(`[alldebrid] ⚠️ Upload error but returning ${readyMagnets.length} instant ready magnets`);
    return readyMagnets;
  }
}

// Retrieve video files for a magnet
async function getFilesFromMagnetId(magnetId, source, config) {
  // Check cache first
  const cachedFiles = cache.getFiles(magnetId);
  if (cachedFiles) {
    logger.info(`[alldebrid] 🎥 ${cachedFiles.length} video(s) found for magnet ID: ${magnetId} (cached)`);
    // logger.debug(`🎥 Filtered videos for magnet ID ${magnetId}: ${JSON.stringify(cachedFiles, null, 2)}`); // Suppressed: too verbose
    return cachedFiles;
  }

  const url = `https://api.alldebrid.com/v4/magnet/files?apikey=${config.API_KEY_ALLEDBRID}`;
  const formData = new FormData();
  formData.append("id[]", magnetId);

  try {
    logger.info(`[alldebrid] 🔄 Retrieving files for magnet ID: ${magnetId}`);
    const response = await makeAllDebridRequest(async () => {
      return axios.post(url, formData, {
        headers: {
          "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
          ...formData.getHeaders()
        }
      });
    }, 'magnet-files');

    if (response.data.status === "success") {
      const files = response.data.data.magnets[0].files;
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".wmv"];

      // Recursive function to extract only video files
      const extractVideos = (fileList) => {
        const videos = [];
        fileList.forEach(file => {
          if (file.e && Array.isArray(file.e)) {
            // If the file contains sub-files, process them recursively
            videos.push(...extractVideos(file.e));
          } else if (file.n && file.l) {
            // Check if the file is a video
            const fileName = file.n.toLowerCase();
            if (videoExtensions.some(ext => fileName.endsWith(ext))) {
              videos.push({
                name: file.n,
                size: file.s || 0,
                link: file.l,
                source // Ajout de la source
              });
            }
          }
        });
        return videos;
      };

      // Extract video files
      const filteredVideos = extractVideos(files);

      // Cache the result
      cache.setFiles(magnetId, filteredVideos);

      logger.info(`[alldebrid] 🎥 ${filteredVideos.length} video(s) found for magnet ID: ${magnetId}`);
      // logger.debug(`🎥 Filtered videos for magnet ID ${magnetId}: ${JSON.stringify(filteredVideos, null, 2)}`); // Suppressed: too verbose

      return filteredVideos;
    } else {
      logger.warn("[alldebrid] ❌ Error retrieving files:", response.data.data);
      return [];
    }
  } catch (error) {
    logger.error("[alldebrid] ❌ File retrieval error:", error);
    return [];
  }
}

// Unlock a link via AllDebrid
async function unlockFileLink(fileLink, config) {
  // Check cache first
  const cachedLink = cache.getLink(fileLink);
  if (cachedLink) {
    logger.info(`[alldebrid] 🔄 Unlocking link: ${fileLink} (cached)`);
    return cachedLink;
  }

  const url = "https://api.alldebrid.com/v4/link/unlock";
  const formData = new FormData();
  formData.append("link", fileLink);

  try {
    logger.info(`[alldebrid] 🔄 Unlocking link: ${fileLink}`);
    const response = await makeAllDebridRequest(async () => {
      return axios.post(url, formData, {
        headers: {
          "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
          ...formData.getHeaders()
        },
        timeout: 10000
      });
    }, 'link-unlock');

    if (response.data.status === "success") {
      const unlockedLink = response.data.data.link;
      // Cache the unlocked link
      cache.setLink(fileLink, unlockedLink);
      return unlockedLink;
    } else {
      logger.warn("[alldebrid] ❌ Error unlocking link:", response.data.data);
      return null;
    }
  } catch (error) {
    logger.error("[alldebrid] ❌ Unlock error:", error);
    return null;
  }
}

// Delete the 20 oldest magnets if total > 100
async function cleanupOldMagnets(config, maxCount = 100, deleteCount = 20) {
  try {
    // Get magnets from AllDebrid API
    const url = `https://api.alldebrid.com/v4.1/magnet/status`;
    
    try {
      const response = await makeAllDebridRequest(async () => {
        return axios.post(url, {}, {
          headers: {
            "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          timeout: 10000
        });
      }, 'magnet-status');
      
      if (response.data.status === "success" && response.data.data.magnets) {
        const magnets = response.data.data.magnets;
        logger.debug(`[alldebrid] 🔢 Active magnets on AllDebrid: ${magnets.length}`);
        
        if (magnets.length > maxCount) {
          // Sort by upload date (oldest first) and take the oldest ones
          const sortedMagnets = magnets.sort((a, b) => a.uploadDate - b.uploadDate);
          const toDelete = sortedMagnets.slice(0, deleteCount);
          logger.info(`[alldebrid] 🧹 Deleting ${toDelete.length} oldest magnets (limit: ${deleteCount}) because total > ${maxCount}.`);

          // Prepare formData with multiple ids[]
          const formData = new FormData();
          toDelete.forEach(magnet => formData.append('ids[]', magnet.id));

          const deleteUrl = `https://api.alldebrid.com/v4/magnet/delete`;
          const deleteResponse = await makeAllDebridRequest(async () => {
            return axios.post(deleteUrl, formData, {
              headers: {
                "Authorization": `Bearer ${config.API_KEY_ALLEDBRID}`,
                ...formData.getHeaders()
              },
              timeout: 10000
            });
          }, 'magnet-delete');
          
          if (deleteResponse.data.status === "success") {
            logger.info(`[alldebrid] 🗑️ Deleted magnets from AllDebrid: ${toDelete.map(m => m.filename || m.id).join(', ')}`);
          } else {
            logger.warn(`[alldebrid] ❌ Failed to delete magnets: [response data suppressed]`);
          }
        }
      }
    } catch (err) {
      logger.error(`[alldebrid] ❌ Error during magnet cleanup: ${err.message}`);
    }
  } catch (err) {
    logger.error("[alldebrid] ❌ Error during magnet cleanup:", err.message);
  }
}

module.exports = { uploadMagnets, getFilesFromMagnetId, unlockFileLink, cleanupOldMagnets };