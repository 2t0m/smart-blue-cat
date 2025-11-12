const axios = require('axios');
const httpClient = require('../utils/http');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

// Retrieve the hash of a torrent on YggTorrent
async function getTorrentHashFromYgg(torrentId) {
  // Check cache first
  const cacheKey = `ygg-hash:${torrentId}`;
  const cachedHash = cache.getHash(cacheKey);
  if (cachedHash) {
    logger.debug(`🎯 Hash cache HIT for torrent ${torrentId}`);
    return cachedHash;
  }
  
  logger.debug(`🔍 Hash cache MISS for torrent ${torrentId}, fetching...`);
  const url = `https://yggapi.eu/torrent/${torrentId}`;
  try {
    const response = await httpClient.get(url, {
      source: 'YGG',
      timeout: 8000,
      maxRetries: 2
    });
    if (response.data && response.data.hash) {
      // Cache the hash for future use
      cache.storeHash(cacheKey, response.data.hash);
      return response.data.hash;
    }
  } catch (error) {
    logger.error(`❌ Hash Retrieval Error for ${torrentId}: ${error.message}`);
    return null;
  }
  return null;
}

// Process torrents based on type, season, and episode
function processTorrents(torrents, type, season, episode, config) {
  const completeSeriesTorrents = [];
  const completeSeasonTorrents = [];
  const episodeTorrents = [];
  const movieTorrents = [];

  if (type === "movie") {
    logger.filter(`Searching for movies with filters - Res: [${config.RES_TO_SHOW.join(', ')}], Lang: [${config.LANG_TO_SHOW.join(', ')}], Codecs: [${config.CODECS_TO_SHOW.join(', ')}]`);
    movieTorrents.push(
      ...torrents
        .filter(torrent => {
          // Normalize resolutions: 4k should be treated as 2160p for filtering
          const normalizedTitle = normalizeTitle(torrent.title);
          
          const hasRes = config.RES_TO_SHOW.some(res => normalizedTitle.includes(res.toLowerCase()));
          const hasLang = config.LANG_TO_SHOW.some(lang => normalizedTitle.includes(lang.toLowerCase()));
          const hasCodec = config.CODECS_TO_SHOW.some(codec => normalizedTitle.includes(codec.toLowerCase()));
          const passes = hasRes && hasLang && hasCodec;
          
          if (!passes) {
            logger.debug(`🚫 Movie rejected "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}`);
          }
          return passes;
        })
        .map(torrent => ({ ...torrent, category: "movieTorrents", source: "YGG" }))
    );
    logger.result(`${movieTorrents.length} movie torrents found.`);
  }

  if (type === "series") {
    // 1. PRIORITY: Search for specific episode first (if season + episode provided)
    if (season && episode) {
      const seasonFormatted = season.padStart(2, '0');
      const episodeFormatted = episode.padStart(2, '0');
      logger.filter(`🎯 PRIORITY 1: Searching for specific episode S${seasonFormatted}E${episodeFormatted}`);
      
      // Very flexible search patterns for episodes
      const episodePatterns = [
        `s${seasonFormatted}e${episodeFormatted}`,
        `s${seasonFormatted}.e${episodeFormatted}`,
        `s${seasonFormatted} e${episodeFormatted}`,
        `s${seasonFormatted}_e${episodeFormatted}`,
        `season ${parseInt(season)} episode ${parseInt(episode)}`,
        `saison ${parseInt(season)} episode ${parseInt(episode)}`,
        `${seasonFormatted}x${episodeFormatted}`,
      ];
      
      logger.debug(`🔍 Episode search patterns: ${episodePatterns.join(', ')}`);
      
      episodeTorrents.push(
        ...torrents
          .filter(torrent => {
            const title = normalizeTitle(torrent.title);
            const hasRes = config.RES_TO_SHOW.some(res => title.includes(res.toLowerCase()));
            const hasLang = config.LANG_TO_SHOW.some(lang => title.includes(lang.toLowerCase()));
            const hasCodec = config.CODECS_TO_SHOW.some(codec => title.includes(codec.toLowerCase()));
            const hasPattern = episodePatterns.some(pattern => title.includes(pattern));
            
            const passes = hasRes && hasLang && hasCodec && hasPattern;
            
            logger.debug(`🔍 Episode "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}, Pattern:${hasPattern} => ${passes ? '✅ ACCEPTED' : '❌ REJECTED'}`);
            
            return passes;
          })
          .map(torrent => ({ ...torrent, category: "episodeTorrents", source: "YGG" }))
      );
      logger.result(`${episodeTorrents.length} specific episode torrents found.`);
    }

    // 2. PRIORITY: Search complete season (reliable fallback)
    if (season) {
      const seasonFormatted = season.padStart(2, '0');
      logger.filter(`🎯 PRIORITY 2: Searching for complete season S${seasonFormatted}`);

      // Patterns for complete seasons
      const seasonPatterns = [
        `saison ${seasonFormatted}`,
        `season ${seasonFormatted}`,
        `s${seasonFormatted}`,
        `saison ${parseInt(season)}`,
        `season ${parseInt(season)}`,
        `s${parseInt(season)} `,
        `s${seasonFormatted} `,
      ];

      logger.debug(`🔍 Season search patterns: ${seasonPatterns.join(', ')}`);

      completeSeasonTorrents.push(
        ...torrents
          .filter(torrent => {
            const title = normalizeTitle(torrent.title);
            const hasRes = config.RES_TO_SHOW.some(res => title.includes(res.toLowerCase()));
            const hasLang = config.LANG_TO_SHOW.some(lang => title.includes(lang.toLowerCase()));
            const hasCodec = config.CODECS_TO_SHOW.some(codec => title.includes(codec.toLowerCase()));
            
            // Check season patterns AND exclude specific episodes
            const hasSeasonPattern = seasonPatterns.some(pattern => title.includes(pattern));
            const isSpecificEpisode = title.match(new RegExp(`s${seasonFormatted}e\\d{2}`, "i")) || 
                                     title.match(new RegExp(`s${seasonFormatted}\\.e\\d{2}`, "i"));
            
            const passes = hasRes && hasLang && hasCodec && hasSeasonPattern && !isSpecificEpisode;
            
            logger.debug(`🔍 Season "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}, Season:${hasSeasonPattern}, NotEpisode:${!isSpecificEpisode} => ${passes ? '✅ ACCEPTED' : '❌ REJECTED'}`);
            
            return passes;
          })
          .map(torrent => ({ ...torrent, category: "completeSeasonTorrents", source: "YGG" }))
      );

      logger.result(`${completeSeasonTorrents.length} complete season torrents found.`);
    }

    // 3. PRIORITY: Search complete series (last resort)
    logger.filter(`🎯 PRIORITY 3: Searching for complete series`);
    
    const completeSeriesPatterns = [
      'complete',
      'integral',
      'integrale',
      'collection',
      'serie complete',
      'series complete',
      'saison 1-',
      'season 1-',
      's01-s',
      's1-s'
    ];

    logger.debug(`🔍 Complete series patterns: ${completeSeriesPatterns.join(', ')}`);

    completeSeriesTorrents.push(
      ...torrents
        .filter(torrent => {
          const title = normalizeTitle(torrent.title);
          const hasRes = config.RES_TO_SHOW.some(res => title.includes(res.toLowerCase()));
          const hasLang = config.LANG_TO_SHOW.some(lang => title.includes(lang.toLowerCase()));
          const hasCodec = config.CODECS_TO_SHOW.some(codec => title.includes(codec.toLowerCase()));
          const hasCompletePattern = completeSeriesPatterns.some(pattern => title.includes(pattern));
          
          const passes = hasRes && hasLang && hasCodec && hasCompletePattern;
          
          logger.debug(`🔍 Complete "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}, Complete:${hasCompletePattern} => ${passes ? '✅ ACCEPTED' : '❌ REJECTED'}`);
          
          return passes;
        })
        .map(torrent => ({ ...torrent, category: "completeSeriesTorrents", source: "YGG" }))
    );
    logger.result(`${completeSeriesTorrents.length} complete series torrents found.`);
  }

  return { completeSeriesTorrents, completeSeasonTorrents, episodeTorrents, movieTorrents };
}

// Search for torrents on YggTorrent

// Normalize title for consistent filtering
function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/\b4k\b/g, '2160p')     // 4K -> 2160p
    .replace(/\bx264\b/g, 'h264')    // x264 -> h264  
    .replace(/\bx265\b/g, 'h265')    // x265 -> h265
    .replace(/\bhevc\b/g, 'h265')    // HEVC -> h265
    .replace(/\bvof\b/g, 'vff')      // VOF -> VFF
    .replace(/\bvf2\b/g, 'vff');     // VF2 -> VFF
}

async function searchYgg(title, type, season, episode, config, frenchTitle, year, imdbId) {
  logger.search(`Searching for torrents on YggTorrent`);
  logger.verbose(`🎯 Search params - Title: "${title}", Type: ${type}, Year: ${year || 'N/A'}, Season: ${season || 'N/A'}, Episode: ${episode || 'N/A'}`);

  // Use the title for the search, add year for movies to improve accuracy
  let searchTitle = (type === 'movie' && year) ? `${title} ${year}` : title;
  if (type === 'movie' && year) {
    logger.info(`🎬 Adding year to movie search: "${title}" → "${searchTitle}"`);
  }

  // Check for custom search keywords
  const customKeywords = process.env.CUSTOM_SEARCH_KEYWORDS || "";
  logger.debug(`🔍 CUSTOM_SEARCH_KEYWORDS: ${customKeywords}`);

  const keywordMap = Object.fromEntries(
    customKeywords.split(",").map(entry => entry.split("=").map(s => s.trim()))
  );

  logger.debug(`🔍 Keyword Map: ${JSON.stringify(keywordMap, null, 2)}`);
  logger.debug(`🔍 Checking for custom keywords for IMDB ID: ${imdbId || 'N/A'}`);

  // Add custom keywords if a match is found
  if (imdbId && keywordMap[imdbId]) {
    const customKeyword = keywordMap[imdbId];
    searchTitle += ` ${customKeyword}`;
    logger.info(`🔍 Custom keywords added for "${title}": ${customKeyword}`);
  } else {
    logger.debug(`🔍 No custom keywords found for "${imdbId || 'N/A'}".`);
  }

  let torrents = await performSearch(searchTitle, type, config, season, episode);

  // If no results, try with the French title
  if (torrents.length === 0 && frenchTitle && title !== frenchTitle) {
    logger.warn(`📢 No results found with "${searchTitle}", trying with "${frenchTitle}"`);
    searchTitle = frenchTitle;

    // Add custom keywords for the French title if available
    if (imdbId && keywordMap[imdbId]) {
      const customKeyword = keywordMap[imdbId];
      searchTitle += ` ${customKeyword}`;
      logger.info(`🔍 Custom keywords added for "${frenchTitle}": ${customKeyword}`);
    }

    torrents = await performSearch(searchTitle, type, config, season, episode);
  }

  if (torrents.length === 0) {
    logger.error(`❌ No torrents found for ${searchTitle}`);
    return { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
  }

  return processTorrents(torrents, type, season, episode, config);
}

async function performSearch(searchTitle, type, config, season = null, episode = null) {
  const categoryIds = type === "movie" 
    ? [2178, 2181, 2183]
    : [2179, 2181, 2182, 2184];

  const categoryParams = categoryIds.map(id => `category_id=${id}`).join('&');
  const requestUrl = `https://yggapi.eu/torrents?q=${encodeURIComponent(searchTitle)}&page=1&per_page=100&order_by=uploaded_at&${categoryParams}`;

  logger.info(`🔍 Performing YGG search with URL: ${requestUrl}`);

  try {
    const response = await httpClient.get(requestUrl, {
      source: 'YGG',
      timeout: 12000,
      maxRetries: 3,
      useCircuitBreaker: true
    });
    let torrents = response.data || [];

    logger.info(`✅ Found ${torrents.length} torrents on YggTorrent for "${searchTitle}".`);
    
    // Log des premiers torrents pour debug
    if (torrents.length > 0) {
      logger.debug(`🔍 First 5 torrent titles found:`);
      torrents.slice(0, 5).forEach((torrent, index) => {
        logger.debug(`   ${index + 1}. "${torrent.title}"`);
      });
    }

    // Enhanced sorting with quality scoring
    torrents.sort((a, b) => {
      const priorityA = prioritizeTorrent(a, config);
      const priorityB = prioritizeTorrent(b, config);

      // Primary sort by config preferences
      if (priorityA.resolution !== priorityB.resolution) {
        return priorityA.resolution - priorityB.resolution;
      }
      if (priorityA.language !== priorityB.language) {
        return priorityA.language - priorityB.language;
      }
      if (priorityA.codec !== priorityB.codec) {
        return priorityA.codec - priorityB.codec;
      }

      // Secondary sort by quality score (higher score = better)
      const scoreA = calculateQualityScore(a, config);
      const scoreB = calculateQualityScore(b, config);
      return scoreB - scoreA; // Descending order (best first)
    });

    // Log top 3 results with their scores for debugging
    if (torrents.length > 0) {
      logger.debug(`📊 Top ${Math.min(3, torrents.length)} YGG torrents by quality score:`);
      torrents.slice(0, 3).forEach((torrent, i) => {
        const score = calculateQualityScore(torrent, config);
        logger.debug(`  ${i + 1}. "${torrent.title}" (Score: ${score}, Seeders: ${torrent.seeders || 0})`);
      });
    }

    return torrents;
  } catch (error) {
    logger.error("❌ Ygg Search Error:", error.message);
    return [];
  }
}

function prioritizeTorrent(torrent, config) {
  const normalizedTitle = normalizeTitle(torrent.title);
  const resolutionPriority = config.RES_TO_SHOW.findIndex(res => normalizedTitle.includes(res.toLowerCase()));
  const languagePriority = config.LANG_TO_SHOW.findIndex(lang => normalizedTitle.includes(lang.toLowerCase()));
  const codecPriority = config.CODECS_TO_SHOW.findIndex(codec => normalizedTitle.includes(codec.toLowerCase()));

  return {
    resolution: resolutionPriority === -1 ? Infinity : resolutionPriority,
    language: languagePriority === -1 ? Infinity : languagePriority,
    codec: codecPriority === -1 ? Infinity : codecPriority
  };
}

/**
 * Calculate advanced quality score for torrent ranking
 * @param {Object} torrent - Torrent data
 * @param {Object} config - Configuration object
 * @returns {number} - Quality score (higher = better)
 */
function calculateQualityScore(torrent, config) {
  let score = 0;
  
  // Seeder score (0-50 points): More seeders = better availability
  const seeders = Math.min(torrent.seeders || 0, 100);
  const seederScore = Math.min(seeders * 0.5, 50);
  score += seederScore;
  
  // Size score (0-25 points): Reasonable size gets bonus
  const sizeGB = (torrent.size || 0) / (1024 * 1024 * 1024);
  let sizeScore = 0;
  if (sizeGB >= 0.1 && sizeGB <= 20) { // Reasonable range for episodes/movies
    sizeScore = Math.min(20 - Math.abs(sizeGB - 5), 25); // Optimal around 5GB
  }
  score += sizeScore;
  
  // Age score (0-15 points): Newer torrents often have better quality
  if (torrent.uploaded_at || torrent.created_at) {
    const uploadDate = new Date(torrent.uploaded_at || torrent.created_at);
    const daysSinceUpload = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
    const ageScore = Math.max(15 - (daysSinceUpload / 30), 0); // Penalty after 30 days
    score += ageScore;
  }
  
  // Title quality indicators (0-10 points)
  const title = (torrent.title || torrent.name || '').toLowerCase();
  
  // Bonus for high quality indicators
  if (title.includes('remux') || title.includes('untouched')) score += 10;
  else if (title.includes('bluray') || title.includes('web-dl')) score += 8;
  else if (title.includes('webrip') || title.includes('hdtv')) score += 6;
  else if (title.includes('dvdrip') || title.includes('tvrip')) score += 3;
  
  // Penalty for low quality indicators
  if (title.includes('cam') || title.includes('ts') || title.includes('tc')) score -= 20;
  else if (title.includes('screener') || title.includes('dvdscr')) score -= 15;
  else if (title.includes('workprint') || title.includes('r5')) score -= 10;
  
  // Resolution preference bonus (based on user config)
  const normalizedTitle = normalizeTitle(title);
  config.RES_TO_SHOW.forEach((res, index) => {
    if (normalizedTitle.includes(res.toLowerCase())) {
      score += (config.RES_TO_SHOW.length - index) * 2; // Higher priority = more points
    }
  });
  
  // Language preference bonus
  config.LANG_TO_SHOW.forEach((lang, index) => {
    if (normalizedTitle.includes(lang.toLowerCase())) {
      score += (config.LANG_TO_SHOW.length - index) * 2;
    }
  });
  
  // Codec preference bonus
  config.CODECS_TO_SHOW.forEach((codec, index) => {
    if (normalizedTitle.includes(codec.toLowerCase())) {
      score += (config.CODECS_TO_SHOW.length - index) * 1.5;
    }
  });

  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

module.exports = { getTorrentHashFromYgg, searchYgg };